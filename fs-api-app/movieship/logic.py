import base64
import re
import urllib.parse
from abc import abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Final, Mapping, Any

import bson
from bson import ObjectId
from flask import request
from pymongo import MongoClient

from movieship.controllers.root import PageResponse, Cursor
from movieship.exceptions import InvalidPaginationException, ResourceNotFoundException


def parse_search_value(value):
    if isinstance(value, ObjectId):
        return ObjectId(str(value))
    elif value.isnumeric():
        return int(value)
    elif value.lower() == "true" or value.lower() == "false":
        return bool(value)
    else:
        return value


class SearchType(Enum):
    EQUIVALENT = 1
    LIKE = 2
    ILIKE = 3


@dataclass
class SearchFilter:
    field: str
    value: str
    type: SearchType

    def search_field(self, resource_fields: dict[str, str]) -> tuple[str, any]:
        field_name = resource_fields[self.field].removeprefix('$')
        match self.type:

            case SearchType.LIKE:
                return field_name, {'$regex': bson.regex.Regex('{}'.format(parse_search_value(self.value)))}
            case SearchType.EQUIVALENT:
                return field_name, {'$eq': parse_search_value(self.value)}
            case SearchType.ILIKE:
                return field_name, {'$regex': bson.regex.Regex('{}'.format(parse_search_value(self.value))),
                                    '$options': 'i'}


class OrderType(Enum):
    ASCENDING = 1
    DESCENDING = 2

    def comparator(self):
        match self:
            case OrderType.ASCENDING:
                return '$gte'
            case OrderType.DESCENDING:
                return '$lte'

    def order(self):
        match self:
            case OrderType.ASCENDING:
                return 1
            case OrderType.DESCENDING:
                return -1


@dataclass
class SearchOrder:
    field: str
    type: OrderType
    allow_nulls: bool

    def match_field(self, resource_fields: dict[str, str]) -> tuple[str, int]:
        field_name = resource_fields[self.field].removeprefix('$')
        return field_name, self.type.order()


def parse_order_meta(param, order_type: OrderType, allow_nulls: bool, order_fields: set[str]):
    return [(lambda field: SearchOrder(field, order_type, allow_nulls))(field) for field in
            filter(lambda field: field in order_fields,
                   request.args.get(param).split(','))]


def parse_filter_meta(param, search_type: SearchType, search_fields: set[str]):
    return [(lambda field, value: SearchFilter(field, value, search_type))(field, value)
            for
            (field, value) in filter(lambda search: search[0] in search_fields,
                                     ((lambda search: search.split(':'))(search) for search in
                                      request.args.get(param).split(',')))]


def parse_search_meta_data(identity_order_field: SearchOrder, order_fields: set[str], search_fields: set[str],
                           page_limit: int):
    filter_meta: list[SearchFilter] = []

    if request.args.get('se'):
        filter_meta += parse_filter_meta('se', SearchType.EQUIVALENT, search_fields)

    if request.args.get('sl'):
        filter_meta += parse_filter_meta('sl', SearchType.LIKE, search_fields)

    if request.args.get('sil'):
        filter_meta += parse_filter_meta('sil', SearchType.ILIKE, search_fields)

    order_meta: list[SearchOrder] = []

    if request.args.get('oa'):
        order_meta += parse_order_meta('oa', OrderType.ASCENDING, False, order_fields)

    if request.args.get('oan'):
        order_meta += parse_order_meta('oan', OrderType.ASCENDING, True, order_fields)

    if request.args.get('od'):
        order_meta += parse_order_meta('od', OrderType.DESCENDING, False, order_fields)

    if request.args.get('odn'):
        order_meta += parse_order_meta('odn', OrderType.DESCENDING, True, order_fields)

    if len(order_meta) == 0:
        order_meta += [identity_order_field]

    limit = page_limit
    if request.args.get('l'):
        limit = min(limit, int(request.args.get('l')))

    position = None
    if request.args.get('p'):
        position = urllib.parse.parse_qs(base64.b64decode(request.args.get('p')).decode("ascii"))

    return SearchMetaData(
        filter_meta,
        order_meta,
        limit,
        position
    )


@dataclass
class SearchMetaData:
    filters: list[SearchFilter]
    orders: list[SearchOrder]
    limit: int
    position: dict[str, str] | None

    def digest(self, resource_fields: dict[str, str]):
        query: dict[str, object] = {}
        search_fields: list[object] = []
        orders_fields: dict[str, any] = {}

        orders_prioritised = self.orders[::-1]
        for order in orders_prioritised:
            (field, orderMeta) = order.match_field(resource_fields)
            orders_fields[field] = orderMeta
            if not order.allow_nulls:
                search_fields += [{field: {
                    "$ne": None
                }}]

        if len(orders_fields) > 0:
            query["$sort"] = orders_fields

        for searchFilter in self.filters:
            (field, searchMeta) = searchFilter.search_field(resource_fields)
            search_fields += [{field: searchMeta}]

        if len(search_fields) == 1:
            query["$match"] = search_fields[0]
        elif len(search_fields) > 1:
            query["$match"] = {
                "$and": search_fields
            }

        return [{"$match": query["$match"]}, {"$sort": query["$sort"]}]


class FieldLogic:
    def __init__(
            self,
            collection_name: str,
            identifier_field: str,
            identity_order: SearchOrder,
            resource_fields: dict[str, str],
            order_fields: set[str] = None,
            search_fields: set[str] = None,
            page_size_limit: int = None,
            pipeline_query_modifiers=None
    ):
        self._collection_name: Final[str] = collection_name
        self._identifier_field: Final[str] = identifier_field
        self._page_size_limit: Final[int] = page_size_limit
        self._identity_order_field: Final[SearchOrder] = identity_order
        self._order_fields: Final[set[str]] = order_fields
        self._search_fields: Final[set[str]] = search_fields
        self._resource_fields: Final[dict[str, str]] = resource_fields
        self._pipeline_query_modifiers = pipeline_query_modifiers

    @abstractmethod
    def _enhancer(self, mongo, values):
        pass

    def map_db_field_name(self, field):
        return self._resource_fields.get(field).removeprefix('$')

    def _listing_key_set_actions(self, search_meta_data: SearchMetaData):
        key_set_actions = []

        if search_meta_data.position:
            primary = search_meta_data.position['p'][0]
            primary_field = search_meta_data.position['pf'][0]
            secondary = None
            secondary_field = None

            if 's' in search_meta_data.position and 'sf' in search_meta_data.position:
                secondary = search_meta_data.position['s'][0]
                secondary_field = search_meta_data.position['sf'][0]

            if not (primary or (primary and secondary)):
                raise InvalidPaginationException("expected both a position and secondary position")

            if len(search_meta_data.orders) < 0:
                raise InvalidPaginationException("expected a order field")

            key_set_actions = []

            if len(search_meta_data.orders) == 1:
                primary_order = list(filter(lambda p: p.field == primary_field, search_meta_data.orders))[0]
                primary_order_comparator = primary_order.type.comparator()
                primary_order_field = self._resource_fields[primary_order.field].removeprefix('$')

                key_set_actions = [{
                    '$match': {
                        '$and': [{
                            '$or': [{
                                primary_order_field: {
                                    primary_order_comparator: parse_search_value(primary)
                                }
                            }]
                        }, {
                            '$and': [{
                                primary_order_field: {
                                    '$ne': parse_search_value(primary)
                                }
                            }]
                        }]
                    }
                }]

            elif len(search_meta_data.orders) > 1:
                primary_order = list(filter(lambda p: p.field == primary_field, search_meta_data.orders))[0]
                primary_order_comparator = primary_order.type.comparator()
                primary_order_field = self._resource_fields[primary_order.field].removeprefix('$')

                secondary_order = list(filter(lambda p: p.field == secondary_field, search_meta_data.orders))[0]
                secondary_order_comparator = secondary_order.type.comparator()
                secondary_order_field = self._resource_fields[secondary_order.field].removeprefix('$')

                key_set_actions = [{
                    '$match': {
                        '$and': [{
                            '$or': [{
                                '$and': [{
                                    primary_order_field: {
                                        primary_order_comparator: parse_search_value(primary)
                                    }
                                }, {
                                    secondary_order_field: {
                                        secondary_order_comparator: parse_search_value(secondary)
                                    }
                                }]
                            }, {
                                primary_order_field: {
                                    primary_order_comparator: parse_search_value(primary)
                                }
                            }]
                        }, {
                            '$and': [{
                                primary_order_field: {
                                    '$ne': parse_search_value(primary)
                                },
                            }]
                        }]
                    }
                }]

        return key_set_actions

    def create_m(self, mongo: MongoClient, event, identity):
        result = mongo['movieDB'][self._collection_name].insert_one(event)
        return self.fetch_single(mongo, identity)

    def create(self, mongo: MongoClient, event):
        result = mongo['movieDB'][self._collection_name].insert_one(event)
        identity = result.inserted_id
        return self.fetch_single(mongo, identity)

    def update(self, mongo: MongoClient, event, identifier: str):
        identifier_field = self.map_db_field_name(self._identifier_field)
        mongo['movieDB'][self._collection_name].update_one({identifier_field: identifier}, {'$set': event})
        return self.fetch_single(mongo, identifier)

    def update_m(self, mongo: MongoClient, event, match_expression: Mapping[str, Any]):
        mongo['movieDB'][self._collection_name].update_one(match_expression, {'$set': event})
        return self.fetch_single_with_expression(mongo, match_expression)

    def delete(self, mongo: MongoClient, match_expression: Mapping[str, Any]):
        resource = self.fetch_single_with_expression(mongo, match_expression)
        mongo['movieDB'][self._collection_name].delete_one(match_expression)
        return resource

    def fetch_single_with_expression(self, mongo: MongoClient, match_expression: object):
        pipeline = [{'$match': match_expression}, {'$limit': 1}]

        if self._pipeline_query_modifiers:
            pipeline += self._pipeline_query_modifiers

        pipeline += [{'$project': self._resource_fields}]

        print("pipe-{}".format(self._collection_name), pipeline)
        result = list(mongo['movieDB'][self._collection_name].aggregate(pipeline))

        if len(result) == 0:
            raise ResourceNotFoundException("resource not found")

        return self._enhancer(mongo, result)[0]

    def fetch_single(self, mongo: MongoClient, identifier, match_expression: object | None = None):
        identifier_field = self._resource_fields.get(self._identifier_field).removeprefix('$')

        pipeline = [{'$match': {
            identifier_field: {
                '$eq': parse_search_value(identifier)
            }
        }}]

        if match_expression is not None:
            pipeline += [match_expression]

        pipeline += [{'$limit': 1}]

        if self._pipeline_query_modifiers:
            pipeline += self._pipeline_query_modifiers

        pipeline += [{'$project': self._resource_fields}]

        result = list(mongo['movieDB'][self._collection_name].aggregate(pipeline))

        if len(result) == 0:
            raise ResourceNotFoundException("resource not found with id {}".format(identifier))

        return self._enhancer(mongo, result)[0]

    def get_search_meta_data(self):
        return parse_search_meta_data(self._identity_order_field, self._order_fields,
                                      self._search_fields, self._page_size_limit)

    def fetch_listing(self, mongo: MongoClient, search_meta_data: SearchMetaData = None):
        if search_meta_data is None:
            search_meta_data = self.get_search_meta_data()

        pipeline = [
            *search_meta_data.digest(self._resource_fields),
            *self._listing_key_set_actions(search_meta_data),
            {'$limit': search_meta_data.limit},

        ]

        if self._pipeline_query_modifiers:
            pipeline += self._pipeline_query_modifiers

        pipeline += [
            {'$project': self._resource_fields}
        ]

        result = self._enhancer(mongo, list(mongo['movieDB'][self._collection_name].aggregate(pipeline)))

        if len(result) > 0 and len(result) == self._page_size_limit:
            last = result[len(result) - 1]

            if len(search_meta_data.orders) == 1:
                cursor_next = base64.b64encode(urllib.parse.urlencode({
                    'p': last[self._identity_order_field.field],
                    'pf': self._identity_order_field.field,
                }).encode('ascii')).decode('ascii')

                return PageResponse(result, Cursor(cursor_next, "prev"))
            elif len(search_meta_data.orders) > 1:
                cursor_next = base64.b64encode(urllib.parse.urlencode({
                    'p': last[self._identity_order_field.field],
                    'pf': self._identity_order_field.field,
                    's': last[search_meta_data.orders[1].field],
                    'sf': search_meta_data.orders[1].field,
                }).encode('ascii')).decode('ascii')

                return PageResponse(result, Cursor(cursor_next, "prev"))

        return PageResponse(result, None)
