import time
from datetime import datetime
from typing import Final

from bson import ObjectId
from flask import request
from jose import jwt

import movieship.logic
from movieship.auth import get_token_auth_header

from movieship.controllers import root, profile
from movieship.exceptions import ProfileNotValidException, ResourceNotFoundException

from movieship.logic import SearchFilter, SearchType, SearchOrder, OrderType, parse_search_value

REVIEW_COLLECTION_NAME: Final[str] = 'reviews'
REVIEW_IDENTIFIER_FIELD: Final[str] = '_id'
REVIEW_FALLBACK_ORDER_FIELD: Final[SearchOrder] = SearchOrder('timestamp', OrderType.DESCENDING, False)
REVIEW_PAGE_SIZE_LIMIT: Final[int] = 25
REVIEW_ALLOWED_ORDER_FIELDS: Final[set[str]] = {'_id', 'timestamp'}
REVIEW_ALLOWED_SEARCH_FIELDS: Final[set[str]] = {'_id', 'timestamp'}
REVIEW_RESOURCE_FIELDS: Final[dict[str, str]] = {
    '_id': "$_id",
    'comment': '$comment',
    'rating': '$rating',
    'timestamp': '$timestamp',
    'imdb_id': '$imdb_id',
    'user': '$user',
    'username': '$username',
}
REVIEW_PIPELINE_QUERY_MODIFIER = [{
    '$lookup': {
        'from': 'profile',
        'localField': 'user',
        'foreignField': 'sub',
        'as': 'result'
    }
}, {
    '$set': {
        'username': {
            '$first': '$result.name'
        }
    }
}]


def getCurrentUser():
    current_user = None

    if "Authorization" in request.headers:
        current_user = jwt.get_unverified_claims(get_token_auth_header())['sub']

    return current_user


class CommentFieldLogic(movieship.logic.FieldLogic):
    def _enhancer(self, mongo, values):
        for review in values:
            review['_id'] = str(review['_id'])

        return values


REVIEW_FIELD_LOGIC: Final[CommentFieldLogic] = CommentFieldLogic(
    REVIEW_COLLECTION_NAME,
    REVIEW_IDENTIFIER_FIELD,
    REVIEW_FALLBACK_ORDER_FIELD,
    REVIEW_RESOURCE_FIELDS,
    REVIEW_ALLOWED_ORDER_FIELDS,
    REVIEW_ALLOWED_SEARCH_FIELDS,
    REVIEW_PAGE_SIZE_LIMIT,
    pipeline_query_modifiers=REVIEW_PIPELINE_QUERY_MODIFIER
)


def get_list(mongo, imdb_id):
    search_meta = REVIEW_FIELD_LOGIC.get_search_meta_data()

    search_meta.filters.append(SearchFilter(
        "imdb_id",
        imdb_id,
        SearchType.EQUIVALENT
    ))

    result = REVIEW_FIELD_LOGIC.fetch_listing(mongo, search_meta)

    return result


def create_resource(mongo, imdb_id):
    event = request.json
    event['user'] = jwt.get_unverified_claims(get_token_auth_header())['sub']

    try:
        user_profile = profile.get_resource(mongo)

        # if user_profile is None or user_profile['name'] is None or user_profile['name'] is '':
        #     raise ProfileNotValidException("profile does not exist or name is missing")

        event['imdb_id'] = imdb_id
        event['timestamp'] = int(round(datetime.now().timestamp()))

        print("inserting", event)
        return REVIEW_FIELD_LOGIC.create(mongo, event)
    except ResourceNotFoundException:
        raise ProfileNotValidException("profile does not exist or name is missing")


def get_resource(mongo, imdb_id):
    current_user = getCurrentUser()

    return REVIEW_FIELD_LOGIC.fetch_single_with_expression(mongo, {
        '$and': [{
            'imdb_id': {
                '$eq': parse_search_value(imdb_id)
            }
        }, {
            'user': {
                '$eq': parse_search_value(current_user)
            }
        }]
    })


def update_resource(mongo, imdb_id):
    current_user = getCurrentUser()

    event = request.json
    event['imdb_id'] = imdb_id

    return REVIEW_FIELD_LOGIC.update_m(mongo, event,
                                       {'user': current_user, 'imdb_id': imdb_id})  # get_resource(mongo)


def delete_resource(mongo, imdb_id):
    current_user = getCurrentUser()

    event = request.json

    return REVIEW_FIELD_LOGIC.delete(mongo, {"imdb_id": imdb_id, "user": current_user})
