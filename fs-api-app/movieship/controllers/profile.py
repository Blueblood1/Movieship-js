import uuid
from typing import Final

from flask import request
from jose import jwt
from pymongo.errors import DuplicateKeyError

import movieship.logic
from movieship.auth import get_token_auth_header
from movieship.exceptions import DisplayNameDuplicateException, ProfileAlreadyExistsException

from movieship.logic import SearchOrder, OrderType

PROFILE_COLLECTION_NAME: Final[str] = 'profile'
PROFILE_IDENTIFIER_FIELD: Final[str] = 'sub'
PROFILE_IDENTITY_ORDER_FIELD: Final[SearchOrder] = SearchOrder('sub', OrderType.ASCENDING, False)
PROFILE_RESOURCE_FIELDS: Final[dict[str, str]] = {
    'sub': '$sub',
    'uuid': '$uuid',
    'name': '$name',
    'watchlist': '$watchlist',
    'watchlist_movies': '$watchlist_movies'
}
PROFILE_PIPELINE_QUERY_MODIFIER = [{
    '$unwind': {
        'path': '$watchlist',
        'includeArrayIndex': 'watch',
        'preserveNullAndEmptyArrays': True
    }
}, {
    '$lookup': {
        'from': 'movies',
        'localField': 'watchlist.imdb_ids',
        'foreignField': 'tconst',
        'as': 'watchlist_movies'
    }
}]


class ProfileFieldLogic(movieship.logic.FieldLogic):
    def _enhancer(self, mongo, values):
        for profile in values:
            profile['_id'] = str(profile['_id'])

            if 'watchlist_movies' in profile:
                for movie in profile['watchlist_movies']:
                    movie['_id'] = str(movie['_id'])

        return values


PROFILE_FIELD_LOGIC: Final[ProfileFieldLogic] = ProfileFieldLogic(
    PROFILE_COLLECTION_NAME,
    PROFILE_IDENTIFIER_FIELD,
    PROFILE_IDENTITY_ORDER_FIELD,
    PROFILE_RESOURCE_FIELDS,
    pipeline_query_modifiers=PROFILE_PIPELINE_QUERY_MODIFIER
)


def get_resource(mongo):
    auth_sub = jwt.get_unverified_claims(get_token_auth_header())['sub']

    return PROFILE_FIELD_LOGIC.fetch_single(mongo, auth_sub)


def add_to_watchlist(mongo):
    auth_sub = jwt.get_unverified_claims(get_token_auth_header())['sub']
    current = PROFILE_FIELD_LOGIC.fetch_single(mongo, auth_sub)

    event = request.json
    watchlist_name_to_add_or_create = event['title']

    watchlist_to_save = []

    if 'watchlist' in current:
        watchlist_current = current['watchlist']
        watchlist_to_add_to = None

        for title in watchlist_current:
            if title == watchlist_name_to_add_or_create:
                watchlist_to_add_to = title
            else:
                watchlist_to_save.append(title)

        if watchlist_to_add_to is None:
            watchlist_to_save += [{
                'title': watchlist_name_to_add_or_create,
                'imdb_ids': [event['imdb_id']]
            }]
        else:
            watchlist_to_save += [{
                'title': watchlist_name_to_add_or_create,
                'imdb_ids': list({event['imdb_id'], *(watchlist_to_add_to['imdb_ids'])})
            }]
    else:
        watchlist_to_save += [{
            'title': watchlist_name_to_add_or_create,
            'imdb_ids': [event['imdb_id']]
        }]

    current['watchlist'] = watchlist_to_save
    current.pop('_id', None)

    result = mongo['movieDB'][PROFILE_COLLECTION_NAME].update_one({'sub': current['sub']}, {'$set': current})

    return PROFILE_FIELD_LOGIC.fetch_single(mongo, auth_sub)


def create(mongo):
    event = request.json
    sub = jwt.get_unverified_claims(get_token_auth_header())['sub']
    event['sub'] = sub
    event['watchlist'] = []

    try:
        return PROFILE_FIELD_LOGIC.create_m(mongo, event, sub)  # get_resource(mongo)
    except DuplicateKeyError:
        raise ProfileAlreadyExistsException("already exists")


def update(mongo):
    auth_sub = jwt.get_unverified_claims(get_token_auth_header())['sub']

    event = request.json

    try:
        return PROFILE_FIELD_LOGIC.update(mongo, event, auth_sub)  # get_resource(mongo)
    except DuplicateKeyError:
        raise DisplayNameDuplicateException("name duplicate")
