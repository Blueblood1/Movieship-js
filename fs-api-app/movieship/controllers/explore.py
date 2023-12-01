from typing import Final

import requests
from flask import make_response, jsonify
from pymongo import MongoClient, UpdateOne

import movieship.logic
from movieship.controllers.root import PageResponse

from movieship.logic import SearchOrder, OrderType

EXPLORE_COLLECTION_NAME: Final[str] = 'shows'
EXPLORE_IDENTIFIER_FIELD: Final[str] = 'imdb_id'
EXPLORE_IDENTITY_ORDER_FIELD: Final[SearchOrder] = SearchOrder('imdb_id', OrderType.ASCENDING, False)
EXPLORE_PAGE_SIZE_LIMIT: Final[int] = 25
EXPLORE_ALLOWED_ORDER_FIELDS: Final[set[str]] = {'imdb_id', 'start_year', 'primaryTitle', 'titleType'}
EXPLORE_ALLOWED_SEARCH_FIELDS: Final[set[str]] = {'imdb_id', 'primaryTitle', 'titleType'}
EXPLORE_RESOURCE_FIELDS: Final[dict[str, str]] = {
    'imdb_id': '$tconst',
    'titleType': '$titleType',
    'primaryTitle': '$primaryTitle',
    'originalTitle': '$originalTitle',
    'startYear': '$startYear',
    'endYear': '$endYear',
    'runtimeMinutes': '$runtimeMinutes',
    'genres': '$genres',
    'averageRating': '$averageRating',
    'averageRatingVotes': '$averageRatingVotes',
    'poster': '$poster',
}


class ExploreFieldLogic(movieship.logic.FieldLogic):
    def _enhancer(self, mongo, values):
        data_to_enhance = []

        for movie in values:
            poster = ''

            if 'poster' in movie:
                poster = movie['poster']

            if poster == '' or poster == 'N/A' or poster is None:
                response = requests.get("http://www.omdbapi.com/?apikey=8126e5b4&i={}".format(movie['imdb_id'])).json()

                if 'Poster' in response:
                    poster = response['Poster']

                if poster == '' or poster == 'N/A' or poster is None:
                    if 'Error' not in response:
                        poster = "https://placehold.co/332x249"

                movie['poster'] = poster
                data_to_enhance.append(UpdateOne({'_id': movie['_id']}, {"$set": {'poster': poster}}))

            movie['_id'] = str(movie['_id'])

        if len(data_to_enhance) != 0:
            mongo['movieDB'][EXPLORE_COLLECTION_NAME].bulk_write(data_to_enhance)

        return values


EXPLORE_FIELD_LOGIC: Final[ExploreFieldLogic] = ExploreFieldLogic(
    EXPLORE_COLLECTION_NAME,
    EXPLORE_IDENTIFIER_FIELD,
    EXPLORE_IDENTITY_ORDER_FIELD,
    EXPLORE_RESOURCE_FIELDS,
    EXPLORE_ALLOWED_ORDER_FIELDS,
    EXPLORE_ALLOWED_SEARCH_FIELDS,
    EXPLORE_PAGE_SIZE_LIMIT,
)


def get_list(mongo: MongoClient) -> PageResponse:
    return EXPLORE_FIELD_LOGIC.fetch_listing(mongo)


def get_resource(mongo, imdb_id):
    return EXPLORE_FIELD_LOGIC.fetch_single(mongo, imdb_id)
