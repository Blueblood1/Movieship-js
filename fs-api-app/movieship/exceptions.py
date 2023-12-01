class InvalidPaginationException(Exception):
    pass


class ResourceNotFoundException(Exception):
    pass


class DisplayNameDuplicateException(Exception):
    pass


class ProfileAlreadyExistsException(Exception):
    pass


class ProfileNotValidException(Exception):
    pass


class AlreadyReviewedException(Exception):
    pass


class WatchlistAlreadyExistsWithName(Exception):
    pass
