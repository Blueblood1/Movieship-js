import os
import csv

import pymongo
from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017/')


def mongo_import(collection_name, target_file):
    os.system(
        f'mongoimport --db movieDB --collection {collection_name} --type tsv --file {target_file} --headerline')


def clean_movies_tsv_data():
    movies_tsv = "./data/title.basics.tsv/data.tsv"
    movies_tsv_clean = "./data/title.basics.tsv/data_clean.tsv"
    with open(movies_tsv, 'r', encoding="mbcs") as fin, \
            open(movies_tsv_clean, 'w', encoding="mbcs", newline="") as fout:
        writer = csv.writer(fout, delimiter='\t')
        for index, row in enumerate(csv.reader(fin, delimiter='\t')):
            if row[4] == '0' or index == 0:
                del row[4]
                writer.writerow(row)
    return movies_tsv_clean


def aggregate_fix_movies_genre_array():
    client['movieDB']['shows'].aggregate([
        {
            '$addFields': {
                'genres': {
                    '$split': [
                        '$genres', ','
                    ]
                }
            }
        }, {
            '$out': 'shows'
        }
    ])


def fix_nulls():
    client['movieDB']['shows'].update_many(
        {"endYear": "\\N"},
        {"$set": {
            "endYear": None
        }}
    )
    client['movieDB']['shows'].update_many(
        {"startYear": "\\N"},
        {"$set": {
            "startYear": None
        }}
    )
    client['movieDB']['shows'].update_many(
        {"runtimeMinutes": "\\N"},
        {"$set": {
            "runtimeMinutes": None
        }}
    )


def make_index():
    # client['movieDB']['profile'].create_index('sub', unique=True)
    # client['movieDB']['profile'].create_index('name', unique=True)

    client['movieDB']['reviews'].create_index([('user', pymongo.DESCENDING), ('imdb_id', pymongo.DESCENDING)],
                                              unique=True)

    # client['movieDB']['watchlist']
    # .create_index([('sub', pymongo.DESCENDING), ('title', pymongo.DESCENDING)], unique=True)

    client['movieDB']['watchlist'].create_index([('sub', pymongo.DESCENDING), ('title', pymongo.DESCENDING)],
                                                unique=True)


# // worked''
# [
#     {
#         '$lookup': {
#             'from': 'ratings',
#             'localField': 'tconst',
#             'foreignField': 'tconst',
#             'as': 'merged'
#         }
#     }, {
#     '$unwind': {
#         'path': '$merged',
#         'preserveNullAndEmptyArrays': False
#     }
# }, {
#     '$addFields': {
#         'averageRating': '$merged.averageRating',
#         'averageRatingVotes': '$merged.numVotes'
#     }
# }, {
#     '$unset': 'merged'
# }, {
#     '$out': 'shows'
# }
# ]


#  TOO SLOW
# def aggregate_ratings_to_movies():
#     client['movieDB']['movies'].aggregate([
#         {
#             '$lookup': {
#                 'from': 'ratings',
#                 'localField': 'tconst',
#                 'foreignField': 'tconst',
#                 'as': 'ratings'
#             }
#         }, {
#             '$addFields': {
#                 'ratings': {
#                     '$arrayElemAt': [
#                         '$ratings', 0
#                     ]
#                 }
#             }
#         }, {
#             '$unset': [
#                 'ratings._id', 'ratings.tconst'
#             ]
#         }, {
#             '$out': 'movies'
#         }
#     ])
#     client['movieDB']['ratings'].drop()


if __name__ == "__main__":
    # clean_movies_tsv = clean_movies_tsv_data()
    # mongo_import('movies', clean_movies_tsv)
    # aggregate_fix_movies_genre_array()
    # mongo_import('ratings', "./data/title.ratings.tsv/data.tsv")
    # aggregate_ratings_to_movies()
    # fix_nulls()
    make_index()
