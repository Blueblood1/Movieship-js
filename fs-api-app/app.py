from typing import Final
from pymongo import MongoClient
from flask import Flask, jsonify, request
from flask_cors import cross_origin
from pymongo.errors import DuplicateKeyError

from movieship.auth import AuthError, decorate_requires_auth, requires_scope

from movieship.controllers.root import *
from movieship.controllers import root, profile
from movieship.controllers import explore
from movieship.controllers import review
from movieship.controllers import watchlist
from movieship.exceptions import ResourceNotFoundException, DisplayNameDuplicateException, ProfileNotValidException, \
    ProfileAlreadyExistsException

MONGO: Final[MongoClient] = MongoClient("mongodb://127.0.0.1:27017")

APP: Final[Flask] = Flask(__name__)


@APP.errorhandler(AuthError)
def handle_auth_error(ex):
    response = jsonify(ex.error)
    response.status_code = ex.status_code
    return response


@APP.route(API_ROOT_PATH, methods=['GET'])
@cross_origin()
def root():
    return make_response(jsonify(ApiResponse(routes(), [])), 200)


@APP.route(EXPLORE_PATH, methods=['GET'])
@cross_origin("http://localhost:4200")
def explore_listing():
    return make_response(jsonify(ApiResponse(explore.get_list(MONGO), [])), 200)


@APP.route(EXPLORE_RESOURCE_PATH, methods=['GET'])
@cross_origin()
def explore_resource(imdb_id):
    return make_response(jsonify(ApiResponse(explore.get_resource(MONGO, imdb_id), [])), 200)


# @APP.route(WATCHLIST_RESOURCE_PATH, methods=['GET'])
# @cross_origin()
# def watchlist_resource():
#     return make_response(jsonify(ApiResponse(watchlist.get_resource(MONGO), [])), 200)

@APP.route(WATCHLIST_PATH, methods=['GET'])
@cross_origin()
@decorate_requires_auth
def watchlist_listing():
    return make_response(jsonify(ApiResponse(watchlist.get_list(MONGO), [])), 200)


@APP.route(WATCHLIST_CREATE_PATH, methods=['POST'])
@cross_origin()
@decorate_requires_auth
def watchlist_create():
    try:
        return make_response(jsonify(ApiResponse(watchlist.create_resource(MONGO), [])), 200)
    except DuplicateKeyError:
        return make_response(jsonify(ApiResponse(None, [{"error": "WatchlistAlreadyExistsWithName", "code": 5}])), 400)


@APP.route(WATCHLIST_RESOURCE_PATH, methods=['POST'])
@cross_origin()
@decorate_requires_auth
def watchlist_update(watchlist_id):
    return make_response(jsonify(ApiResponse(watchlist.update(MONGO, watchlist_id), [])), 200)


@APP.route(WATCHLIST_DELETE_PATH, methods=['POST'])
@cross_origin()
@decorate_requires_auth
def watchlist_delete(watchlist_id):
    try:
        return make_response(jsonify(ApiResponse(watchlist.delete_resource(MONGO, watchlist_id), [])), 200)
    except ResourceNotFoundException:
        return make_response(jsonify(ApiResponse(None, [{"error": "ResourceNotFoundException", "code": 2}])), 404)


@APP.route(REVIEW_LISTING_PATH, methods=['GET'])
@cross_origin()
def review_listing(imdb_id):
    return make_response(jsonify(ApiResponse(review.get_list(MONGO, imdb_id), [])), 200)


@APP.route(REVIEW_PATH, methods=['GET', 'POST'])
@cross_origin()
@decorate_requires_auth
def comments_resource_delete_update(imdb_id):
    if request.method == 'POST':
        return make_response(jsonify(ApiResponse(review.update_resource(MONGO, imdb_id), [])), 200)
    else:
        try:
            return make_response(jsonify(ApiResponse(review.get_resource(MONGO, imdb_id), [])), 200)
        except ResourceNotFoundException:
            return make_response(jsonify(ApiResponse(None, [{"error": "ResourceNotFoundException", "code": 2}])), 404)


@APP.route(REVIEW_DELETE_PATH, methods=['POST'])
@cross_origin()
@decorate_requires_auth
def review_delete(imdb_id):
    return make_response(jsonify(ApiResponse(review.delete_resource(MONGO, imdb_id), [])), 200)


@APP.route(REVIEW_CREATE_PATH, methods=['POST'])
@cross_origin()
@decorate_requires_auth
def review_create(imdb_id):
    try:
        return make_response(jsonify(ApiResponse(review.create_resource(MONGO, imdb_id), [])), 200)
    except ResourceNotFoundException:
        return make_response(jsonify(ApiResponse(None, [{"error": "ResourceNotFoundException", "code": 2}])), 404)
    except ProfileNotValidException:
        return make_response(jsonify(ApiResponse(None, [{"error": "ProfileNotValidException", "code": 3}])), 400)
    # except DuplicateKeyError:
    #     return make_response(jsonify(ApiResponse(None, [{"error": "AlreadyReviewedException", "code": 4}])), 400)


@APP.route(PROFILE_PATH_RESOURCE, methods=['GET'])
@cross_origin()
@decorate_requires_auth
def profile_resource():
    try:
        return make_response(jsonify(ApiResponse(profile.get_resource(MONGO), [])), 200)
    except ResourceNotFoundException:
        return make_response(jsonify(ApiResponse(None, [{"error": "ResourceNotFoundException", "code": 2}])), 404)


@APP.route(PROFILE_ADD_TO_WATCH_LIST_PATH, methods=['POST'])
@cross_origin()
@decorate_requires_auth
def profile_add_to_watch_list():
    return make_response(jsonify(ApiResponse(profile.add_to_watchlist(MONGO), [])), 200)


@APP.route(PROFILE_CREATE_PATH, methods=['POST'])
@cross_origin()
@decorate_requires_auth
def profile_create():
    try:
        return make_response(jsonify(ApiResponse(profile.create(MONGO), [])), 200)
    except ProfileAlreadyExistsException:
        return make_response(jsonify(ApiResponse(None, [{"error": "ProfileAlreadyExistsException", "code": 6}])), 404)


@APP.route(PROFILE_PATH_RESOURCE, methods=['POST'])
@cross_origin()
@decorate_requires_auth
def profile_update():
    try:
        return make_response(jsonify(ApiResponse(profile.update(MONGO), [])), 200)
    except DisplayNameDuplicateException:
        return make_response(jsonify(ApiResponse(None, [{"error": "DisplayNameDuplicateException", "code": 3}])), 404)


if __name__ == '__main__':
    APP.run(debug=True)
