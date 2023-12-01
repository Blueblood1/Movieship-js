from dataclasses import dataclass
from typing import Final, TypeVar

from flask import make_response, jsonify

T = TypeVar("T")


@dataclass
class ApiResponse:
    data: T
    errors: list[dict[str, any]]


@dataclass
class Cursor:
    next: str
    previous: str


@dataclass
class PageResponse:
    page: list[T]
    cursor: Cursor | None


def make_api(root: dict[str, any], name: str, can_create: str = "", can_destroy="", can_update="", can_list="",
             can_resource="", path_identifiers: list[str] = None, primary_identifier: str = None):
    if can_create:
        root[name + "_CREATE"] = can_create
    if can_destroy:
        root[name + "_DELETE"] = can_destroy
    if can_update:
        root[name + "_UPDATE"] = can_update
    if can_list:
        root[name + "_LISTING"] = can_list
    if can_resource:
        root[name + "_RESOURCE"] = can_resource
    if path_identifiers:
        root[name + "_PATH_IDENTIFIERS"] = path_identifiers
    if primary_identifier:
        root[name + "_PRIMARY_IDENTIFIER"] = primary_identifier

    return root


API_ROOT_PATH: Final[str] = "/api/v1"

EXPLORE_PATH: Final[str] = API_ROOT_PATH + "/explore"
EXPLORE_RESOURCE_PATH: Final[str] = EXPLORE_PATH + "/<imdb_id>"

REVIEW_PATH: Final[str] = EXPLORE_RESOURCE_PATH + "/review"
REVIEW_LISTING_PATH: Final[str] = REVIEW_PATH + "/list"
REVIEW_CREATE_PATH: Final[str] = REVIEW_PATH + "/create"
REVIEW_DELETE_PATH: Final[str] = REVIEW_PATH + "/delete"

PROFILE_PATH_RESOURCE: Final[str] = API_ROOT_PATH + "/profile"
PROFILE_CREATE_PATH: Final[str] = PROFILE_PATH_RESOURCE + "/create"

PROFILE_ADD_TO_WATCH_LIST_PATH: Final[str] = PROFILE_PATH_RESOURCE + "/watchlist"

WATCHLIST_PATH: Final[str] = API_ROOT_PATH + "/watchlist"
WATCHLIST_RESOURCE_PATH: Final[str] = WATCHLIST_PATH + "/<watchlist_id>"
WATCHLIST_CREATE_PATH: Final[str] = WATCHLIST_PATH + "/create"
WATCHLIST_DELETE_PATH: Final[str] = WATCHLIST_RESOURCE_PATH + "/delete"


def routes():
    api_root: dict[str, any] = dict()
    api_root["API_ROOT"] = API_ROOT_PATH

    make_api(api_root, "EXPLORE", can_list=EXPLORE_PATH, can_resource=EXPLORE_RESOURCE_PATH,
             path_identifiers=['imdb_id'], primary_identifier='imdb_id')
    make_api(api_root, "REVIEW", can_list=REVIEW_LISTING_PATH, can_resource=REVIEW_PATH,
             can_create=REVIEW_CREATE_PATH, can_update=REVIEW_PATH, can_destroy=REVIEW_DELETE_PATH,
             path_identifiers=['imdb_id']),
    make_api(api_root, "PROFILE", can_resource=PROFILE_PATH_RESOURCE, can_create=PROFILE_CREATE_PATH,
             can_update=PROFILE_PATH_RESOURCE),
    make_api(api_root, "WATCHLIST", can_list=WATCHLIST_PATH,
             can_update=WATCHLIST_RESOURCE_PATH,
             can_destroy=WATCHLIST_DELETE_PATH, can_create=WATCHLIST_CREATE_PATH, path_identifiers=['watchlist_id'],
             primary_identifier='watchlist_id')

    return api_root
