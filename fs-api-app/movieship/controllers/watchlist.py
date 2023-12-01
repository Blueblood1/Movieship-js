import uuid
from typing import Final

from bson import ObjectId
from flask import request
from jose import jwt
from pymongo.errors import DuplicateKeyError

import movieship.logic
from movieship.auth import get_token_auth_header
from movieship.exceptions import DisplayNameDuplicateException

from movieship.logic import SearchOrder, OrderType, SearchType, SearchFilter

WATCHLIST_COLLECTION_NAME: Final[str] = 'watchlist'
WATCHLIST_IDENTIFIER_FIELD: Final[str] = '_id'
WATCHLIST_IDENTITY_ORDER_FIELD: Final[SearchOrder] = SearchOrder('_id', OrderType.ASCENDING, False)
WATCHLIST_PAGE_SIZE_LIMIT: Final[int] = 25
WATCHLIST_ALLOWED_ORDER_FIELDS: Final[set[str]] = {'_id', 'sub', 'title'}
WATCHLIST_ALLOWED_SEARCH_FIELDS: Final[set[str]] = {'_id', 'sub', 'title'}
WATCHLIST_RESOURCE_FIELDS: Final[dict[str, str]] = {
    '_id': '$_id',
    'title': '$title',
    'sub': '$sub',
    'watchlist': '$watchlist',
    'watchlist_movies': '$watchlist_movies'
}
WATCHLIST_PIPELINE_QUERY_MODIFIER = [{
    '$lookup': {
        'from': 'movies',
        'localField': 'watchlist',
        'foreignField': 'tconst',
        'as': 'watchlist_movies'
    }
}]


class WatchlistFieldLogic(movieship.logic.FieldLogic):
    def _enhancer(self, mongo, values):
        for profile in values:
            profile['_id'] = str(profile['_id'])

            if 'watchlist_movies' in profile:
                for movie in profile['watchlist_movies']:
                    movie['_id'] = str(movie['_id'])

        return values


WATCHLIST_FIELD_LOGIC: Final[WatchlistFieldLogic] = WatchlistFieldLogic(
    WATCHLIST_COLLECTION_NAME,
    WATCHLIST_IDENTIFIER_FIELD,
    WATCHLIST_IDENTITY_ORDER_FIELD,
    WATCHLIST_RESOURCE_FIELDS,
    WATCHLIST_ALLOWED_ORDER_FIELDS,
    WATCHLIST_ALLOWED_SEARCH_FIELDS,
    WATCHLIST_PAGE_SIZE_LIMIT,
    pipeline_query_modifiers=WATCHLIST_PIPELINE_QUERY_MODIFIER
)


def get_list(mongo):
    search_meta = WATCHLIST_FIELD_LOGIC.get_search_meta_data()

    sub = jwt.get_unverified_claims(get_token_auth_header())['sub']

    search_meta.filters.append(SearchFilter(
        "sub",
        sub,
        SearchType.EQUIVALENT
    ))

    result = WATCHLIST_FIELD_LOGIC.fetch_listing(mongo, search_meta)

    return result


def create_resource(mongo):
    event = request.json
    event['sub'] = jwt.get_unverified_claims(get_token_auth_header())['sub']
    event['watchlist'] = []

    return WATCHLIST_FIELD_LOGIC.create(mongo, event)


def get_resource(mongo):
    auth_sub = jwt.get_unverified_claims(get_token_auth_header())['sub']

    return WATCHLIST_FIELD_LOGIC.fetch_single(mongo, auth_sub)


def update(mongo, watchlist_id):
    sub = jwt.get_unverified_claims(get_token_auth_header())['sub']

    event = request.json

    return WATCHLIST_FIELD_LOGIC.update_m(mongo, event,
                                          {'sub': sub, '_id': ObjectId(watchlist_id)})


def delete_resource(mongo, watchlist_id):
    sub = jwt.get_unverified_claims(get_token_auth_header())['sub']

    return WATCHLIST_FIELD_LOGIC.delete(mongo, {"_id": ObjectId(watchlist_id), "sub": sub})
