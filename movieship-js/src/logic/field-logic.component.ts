import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  catchError,
  debounceTime,
  map,
  mergeMap,
  Observable,
  of,
  Subject,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { AuthService } from '@auth0/auth0-angular';
import { Component, OnInit } from '@angular/core';
import { environment } from '../environments/environment';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { MessageService } from 'primeng/api';

export class ApiResponse<T> {
  data: T;
  errors: ApiError[];
  constructor(data: T, errors: ApiError[]) {
    this.data = data;
    this.errors = errors;
  }
}

export class ApiError {
  code: ErrorCode;
  error: string;
  constructor(code: ErrorCode, error: string) {
    this.code = code;
    this.error = error;
  }
}

export type ApiRoot = {
  API_ROOT: string;
} & {
  REVIEW_CREATE: string;
  REVIEW_DELETE: string;
  REVIEW_LISTING: string;
  REVIEW_PATH_IDENTIFIERS: string[];
  REVIEW_RESOURCE: string;
  REVIEW_UPDATE: string;
} & {
  EXPLORE_LISTING: string;
  EXPLORE_PATH_IDENTIFIERS: string[];
  EXPLORE_PRIMARY_IDENTIFIER: string;
  EXPLORE_RESOURCE: string;
} & {
  PROFILE_CREATE: string;
  PROFILE_DELETE: string;
  PROFILE_RESOURCE: string;
  PROFILE_UPDATE: string;
} & {
  WATCHLIST_CREATE: string;
  WATCHLIST_DELETE: string;
  WATCHLIST_RESOURCE: string;
  WATCHLIST_LISTING: string;
  WATCHLIST_PATH_IDENTIFIERS: string[];
  WATCHLIST_PRIMARY_IDENTIFIER: string;
  WATCHLIST_UPDATE: string;
};

export enum ErrorCode {
  Unknown = 0,
  InvalidPaginationException = 1,
  ResourceNotFoundException = 2,
  ProfileNotValidException = 3,
  AlreadyReviewedException = 4,
  WatchlistAlreadyExistsWithName = 5,
  ProfileAlreadyExistsException = 6,
}

interface IFieldLogicConfigType {
  type: 'CREATABLE' | 'DESTROYABLE' | 'UPDATABLE' | 'LISTABLE' | 'RESOURCE';
  resolvePath: (api: ApiRoot) => string;
}

export interface IFieldLogicCreatable extends IFieldLogicConfigType {
  type: 'CREATABLE'; //       - Create single resource.
}

export interface IFieldLogicDestroyable extends IFieldLogicConfigType {
  type: 'DESTROYABLE'; //     - Delete single resource.
}

export interface IFieldLogicUpdatable extends IFieldLogicConfigType {
  type: 'UPDATABLE'; //       - Update single resource.
}

export interface IFieldLogicListable extends IFieldLogicConfigType {
  type: 'LISTABLE'; //        - Fetch list of resource.
  onInitAction?: boolean;
}

export interface IFieldLogicResource extends IFieldLogicConfigType {
  type: 'RESOURCE'; //        - Fetch single resource.
  onResourceNotFound: 'ERROR' | 'CREATE';
  onInitAction?: boolean;
}

export type IFieldLogicSettings = {
  creatable?: IFieldLogicCreatable;
  destroyable?: IFieldLogicDestroyable;
  updatable?: IFieldLogicUpdatable;
  listable?: IFieldLogicListable;
  resource?: IFieldLogicResource;
};

export type FieldDefinition<T> = {
  control: FormControl<T | null>;
  enableCreate: boolean;
  enableUpdate: boolean;
};

export type FieldLogic<MODEL> = {
  [FIELD in keyof Partial<MODEL>]: FieldDefinition<MODEL[FIELD]>;
};

export type SearchMetaField = {
  orderAsc: boolean;
  orderDesc: boolean;
  enableLike: boolean;
  enableILike: boolean;
  enableEquivalent: boolean;
};

export enum SearchFilterTypeNames {
  EQ = 'eq',
  LIKE = 'like',
  I_LIKE = 'i-like',
  GT = 'gt',
  LT = 'lt',
}

interface SearchFilterOption {
  name: SearchFilterTypeNames;
}

export type SearchMetaFieldDefinition<FIELD, T> = {
  field: FIELD;
  control: FormControl<T | null>;
  orderControl: FormControl<boolean | null>;
  filterControl: FormControl<SearchFilterOption | null>;
  config: SearchMetaField;
};

export type SearchMeta<MODEL> = SearchMetaFieldDefinition<
  keyof MODEL,
  MODEL[keyof MODEL]
> & {
  value: MODEL[keyof MODEL] | null;
};

export type SearchLogic<MODEL> = {
  [FIELD in keyof Partial<MODEL>]: SearchMetaFieldDefinition<
    FIELD,
    MODEL[FIELD]
  >;
};

type KeyPrefix<T, P extends string> = {
  [K in keyof T as K extends string ? `${P}${K}` : never]: T[K];
};

export type FormControlFields<MODEL> = {
  [FIELD in keyof MODEL]: FormControl<MODEL[FIELD] | null>;
} & {
  [FIELD in KeyPrefix<Partial<keyof MODEL>, 'sm-o-'>]: FormControl<
    boolean | null
  >;
} & {
  [FIELD in KeyPrefix<
    Partial<keyof MODEL>,
    'sm-f-'
  >]: FormControl<SearchFilterOption | null>;
};

const buildPath = <MODEL extends object>(
  path: string,
  pathIds: Map<string, string>,
  searchMeta?: Map<keyof MODEL, SearchMeta<MODEL>>
) => {
  let modifiedPath = path;
  let pathParamsStarted = false;

  if (modifiedPath.endsWith('/')) {
    modifiedPath = modifiedPath.substring(0, modifiedPath.length - 1);
  }

  pathIds.forEach((value, key) => {
    modifiedPath = modifiedPath.replace(`<${key}>`, value);
  });

  if (searchMeta) {
    const searchEq: SearchMeta<MODEL>[] = [];
    const searchLike: SearchMeta<MODEL>[] = [];
    const searchILike: SearchMeta<MODEL>[] = [];
    const orderAsc: SearchMeta<MODEL>[] = [];
    const orderDesc: SearchMeta<MODEL>[] = [];

    searchMeta.forEach(value => {
      if (value.value != '') {
        if (value.config.enableLike) {
          if (
            value.filterControl.value?.name != undefined &&
            value.filterControl.value?.name === SearchFilterTypeNames.LIKE
          ) {
            searchLike.push(value);
          }
        }
        if (value.config.enableILike) {
          if (
            value.filterControl.value?.name != undefined &&
            value.filterControl.value?.name === SearchFilterTypeNames.I_LIKE
          ) {
            searchILike.push(value);
          }
        }
        if (value.config.enableEquivalent) {
          if (
            value.filterControl.value?.name != undefined &&
            value.filterControl.value?.name === SearchFilterTypeNames.EQ
          ) {
            searchEq.push(value);
          }
        }
      }
      if (value.config.orderAsc) {
        if (
          value.orderControl.value !== null &&
          value.orderControl.value === true
        ) {
          orderAsc.push(value);
        }
      }
      if (value.config.orderDesc) {
        if (
          value.orderControl.value !== null &&
          value.orderControl.value === false
        ) {
          orderDesc.push(value);
        }
      }
    });

    if (searchEq.length != 0) {
      modifiedPath += pathParamsStarted ? '&' : '?';
      pathParamsStarted = true;
      modifiedPath += 'se=';
      modifiedPath += searchEq
        .map(value => `${value.field as string}:${value.value}`)
        .join(',');
    }

    if (searchLike.length != 0) {
      modifiedPath += pathParamsStarted ? '&' : '?';
      pathParamsStarted = true;
      modifiedPath += 'sl=';
      modifiedPath += searchLike
        .map(value => `${value.field as string}:${value.value}`)
        .join(',');
    }

    if (searchILike.length != 0) {
      modifiedPath += pathParamsStarted ? '&' : '?';
      pathParamsStarted = true;
      modifiedPath += 'sil=';
      modifiedPath += searchILike
        .map(value => `${value.field as string}:${value.value}`)
        .join(',');
    }

    if (orderAsc.length != 0) {
      modifiedPath += pathParamsStarted ? '&' : '?';
      pathParamsStarted = true;
      modifiedPath += 'oa=';
      modifiedPath += orderAsc
        .map(value => `${value.field as string}`)
        .join(',');
    }

    if (orderDesc.length != 0) {
      modifiedPath += pathParamsStarted ? '&' : '?';
      pathParamsStarted = true;
      modifiedPath += 'od=';
      modifiedPath += orderDesc
        .map(value => `${value.field as string}`)
        .join(',');
    }
  }

  return {
    path: environment.config.apiBaseUrl + modifiedPath,
    pathParamsStarted,
  };
};

type Cursor = {
  next: string;
  previous: string;
};

type PageResponse<MODEL> = {
  page: MODEL[];
  cursor: Cursor;
};

@Component({
  template: '',
})
export abstract class FieldLogicComponent<MODEL extends object>
  implements OnInit
{
  protected constructor(
    private httpClient: HttpClient,
    protected authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private messageService: MessageService
  ) {}

  isLoading = false;

  abstract resourceName: string;

  abstract settings: IFieldLogicSettings;

  abstract fieldLogic: FieldLogic<MODEL>;

  abstract searchLogic: SearchLogic<MODEL>;

  abstract resolvePathIdentifiers: (api: ApiRoot) => string[] | undefined;
  abstract resolvePrimaryIdentifier: (api: ApiRoot) => string | undefined;

  abstract baseValue: () => Partial<MODEL>;
  abstract afterLoadListing?: () => void;
  abstract afterCreate?: (resource?: MODEL) => void;

  get fieldLogicFormGroup() {
    const controls = {} as FormControlFields<MODEL>;

    Object.keys(this.fieldLogic).forEach(field => {
      const logic = this.fieldLogic[field as keyof MODEL];
      controls[field as keyof MODEL] = logic.control as any;
    });

    const formGroup = new FormGroup(controls, { updateOn: 'change' });

    Object.defineProperty(this, 'fieldLogicFormGroup', {
      value: formGroup,
      writable: false,
      configurable: false,
      enumerable: false,
    });

    return formGroup;
  }

  searchFilterType: SearchFilterOption[] = [
    { name: SearchFilterTypeNames.LIKE },
    { name: SearchFilterTypeNames.I_LIKE },
    { name: SearchFilterTypeNames.EQ },
  ];

  get searchLogicFormGroup() {
    const controls = {} as FormControlFields<MODEL>;

    Object.keys(this.searchLogic).forEach(field => {
      const logic = this.searchLogic[field as keyof MODEL];
      controls[field as keyof MODEL] = logic.control as any;
      controls[`sm-o-${field}` as KeyPrefix<keyof MODEL, 'sm-o-'>] =
        logic.orderControl as any;
      controls[`sm-f-${field}` as KeyPrefix<keyof MODEL, 'sm-f-'>] =
        logic.filterControl as any;
    });

    const formGroup = new FormGroup(controls, { updateOn: 'change' });

    Object.defineProperty(this, 'searchLogicFormGroup', {
      value: formGroup,
      writable: false,
      configurable: false,
      enumerable: false,
    });

    return formGroup;
  }

  searchMetaDataMap: Map<keyof MODEL, SearchMeta<MODEL>> = new Map();

  apiErrors: ApiError[] = [];

  fieldState: 'LOADING' | 'CREATE' | 'EDIT' | 'LISTING' = 'LOADING';

  selectedResourceIdentifiers: Map<string, string> = new Map();
  resource?: MODEL = undefined;

  listingCursor?: Cursor = undefined;
  listingLastPath?: string = undefined;

  listing?: MODEL[] = undefined;

  hasListing(): boolean {
    const result = (this.listing?.length || 0) >= 1;

    return result;
  }

  api?: ApiRoot = undefined;
  private apiObservable = new Observable<ApiRoot>(subscriber => {
    if (this.api) {
      subscriber.next(this.api);
      subscriber.complete();
    }

    const currentDate = new Date();

    const updateThresholdDate = currentDate.setHours(
      currentDate.getHours() - 1
    );

    const lastUpdate = parseInt(sessionStorage.getItem('API_TIMESTAMP') || '0');

    if (lastUpdate < updateThresholdDate) {
      this.requestPipe<ApiRoot>(
        this.httpClient.get(environment.config.apiRootUrl, this.httpOptions)
      ).subscribe(apiRoot => {
        if (apiRoot === undefined || apiRoot.data === undefined)
          throw Error('Api root undefined');

        sessionStorage.setItem('API_ROOT', JSON.stringify(apiRoot.data));
        sessionStorage.setItem('API_TIMESTAMP', String(Date.now()));
        this.api = apiRoot.data;
        subscriber.next(apiRoot.data);
        subscriber.complete();
      });
    } else {
      const sessionRoot = sessionStorage.getItem('API_ROOT');

      if (sessionRoot === null || sessionRoot === '')
        throw Error('Api root is missing from session storage.');

      const api = JSON.parse(sessionRoot) as ApiRoot;
      this.api = api;
      subscriber.next(api);
      subscriber.complete();
    }
  });

  private httpHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  private httpOptions = {
    headers: new HttpHeaders(this.httpHeaders),
  };

  private requestPipe<DATA_TYPE>(
    response: Observable<unknown>
  ): Observable<ApiResponse<DATA_TYPE>> {
    return response.pipe(
      map(response => response as ApiResponse<DATA_TYPE>),
      catchError(error => {
        if (error instanceof ErrorEvent || error instanceof ProgressEvent) {
          return of(
            new ApiResponse(undefined as DATA_TYPE, [
              { code: ErrorCode.Unknown, error: 'unknown error' },
            ])
          );
        } else {
          return of(
            new ApiResponse(
              error.error.data as DATA_TYPE,
              error.error.errors as ApiError[]
            )
          );
        }
      })
    );
  }

  private subjectSearch = new Subject<SearchMeta<MODEL>>();
  private subjectSearchPipe = this.subjectSearch.pipe(debounceTime(500));

  private setupSearchSubscribers(): void {
    Object.entries(this.searchLogic).forEach(entry => {
      const definition = entry[1] as SearchMetaFieldDefinition<
        keyof MODEL,
        MODEL[keyof MODEL]
      >;
      definition.control.valueChanges.subscribe(value =>
        this.subjectSearch.next({ ...definition, value })
      );
      definition.filterControl.valueChanges.subscribe(() => {
        const fieldValue = definition.control.value;

        if (fieldValue !== '') {
          this.subjectSearch.next({
            ...definition,
            value: definition.control.value,
          });
        } else {
          if (this.searchMetaDataMap.has(definition.field)) {
            this.searchMetaDataMap.delete(definition.field);
          }
        }
      });
      definition.orderControl.valueChanges.subscribe(() => {
        this.subjectSearch.next({
          ...definition,
          value: definition.control.value,
        });
      });
    });

    this.subjectSearchPipe.subscribe((v: SearchMeta<MODEL>) => {
      this.fetchListing(v);
    });
  }

  patchFormValues(resource: MODEL): void {
    const fieldLogicResource = {} as MODEL;

    Object.entries(this.fieldLogic).forEach(entry => {
      const field = entry[0] as keyof MODEL;

      if (resource && field in resource) {
        fieldLogicResource[field] = resource[field];
      } else {
        fieldLogicResource[field] = '' as any;
      }
    });

    this.fieldLogicFormGroup.reset(fieldLogicResource as any);
  }

  clearValue(): void {
    this.listingLastPath = undefined;
    this.listingCursor = undefined;
    this.listing = undefined;
    this.resource = undefined;

    if (this.settings.listable) {
      this.fetchListing();
    }

    if (this.settings.resource) {
      this.fetchResource();
    }
  }

  onCreate(): void {
    this.apiObservable
      .pipe(
        map((api: ApiRoot) => {
          if (!this.settings.creatable) throw Error('Create not configured');

          const pathIds: Map<string, string> = new Map();
          this.resolvePathIdentifiers(api)?.forEach(pid => {
            if (this.route.snapshot.paramMap.has(pid)) {
              pathIds.set(pid, this.route.snapshot.paramMap.get(pid) as string);
            }
          });

          const { path } = buildPath(
            this.settings.creatable.resolvePath(api),
            pathIds
          );

          const event = {
            ...this.fieldLogicFormGroup.value,
            ...this.baseValue(),
          };

          this.authService
            .getAccessTokenSilently()
            .pipe(
              switchMap(token => {
                return this.requestPipe<MODEL>(
                  this.httpClient.post(path, this.fieldLogicFormGroup.value, {
                    ...this.httpOptions,
                    headers: new HttpHeaders({
                      ...this.httpHeaders,
                      Authorization: `Bearer ${token}`,
                    }),
                  })
                );
              }),
              take(1)
            )
            .subscribe(resource => {
              if (resource?.errors && resource.errors.length > 0) {
                resource.errors.forEach(error => {
                  this.messageService.add({
                    severity: 'error',
                    summary: 'Failed to create!',
                    detail: error.error,
                  });
                });
              } else {
                this.messageService.add({
                  severity: 'success',
                  summary: 'Success!',
                  detail: this.resourceName + ' has been successfully created.',
                });
              }

              this.clearValue();
              if (this.afterCreate) {
                this.afterCreate(resource.data);
              }
            });
        }),
        take(1)
      )
      .subscribe();
  }

  onDelete(): void {
    this.apiObservable
      .pipe(
        map((api: ApiRoot) => {
          if (!this.settings.destroyable) throw Error('Delete not configured');

          const pathIds: Map<string, string> = new Map(
            this.selectedResourceIdentifiers
          );
          this.resolvePathIdentifiers(api)?.forEach(pid => {
            if (this.route.snapshot.paramMap.has(pid)) {
              pathIds.set(pid, this.route.snapshot.paramMap.get(pid) as string);
            }
          });

          const { path } = buildPath(
            this.settings.destroyable.resolvePath(api),
            pathIds
          );

          this.authService
            .getAccessTokenSilently()
            .pipe(
              switchMap(token => {
                return this.requestPipe<MODEL>(
                  this.httpClient.post(
                    path,
                    {}, // TODO Flask isn't liking the DELETE method here... some cors issue but no time to figure it out
                    {
                      ...this.httpOptions,
                      headers: new HttpHeaders({
                        ...this.httpHeaders,
                        Authorization: `Bearer ${token}`,
                      }),
                    }
                  )
                );
              }),
              take(1)
            )
            .subscribe(resource => {
              this.clearValue();
            });
        }),
        take(1)
      )
      .subscribe(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success!',
          detail: this.resourceName + ' has been successfully deleted.',
        });
      });
  }

  onUpdate(value?: Partial<MODEL>): void {
    this.apiObservable
      .pipe(
        map((api: ApiRoot) => {
          if (!this.settings.updatable) throw Error('Update not configured');

          const pathIds: Map<string, string> = new Map(
            this.selectedResourceIdentifiers
          );

          this.resolvePathIdentifiers(api)?.forEach(pid => {
            if (this.route.snapshot.paramMap.has(pid)) {
              pathIds.set(pid, this.route.snapshot.paramMap.get(pid) as string);
            }
          });

          const { path } = buildPath(
            this.settings.updatable.resolvePath(api),
            pathIds
          );

          const event = value ? value : ({} as MODEL);

          if (!value) {
            Object.entries(this.fieldLogic)
              .map(x => {
                return {
                  fieldName: x[0] as keyof MODEL,
                  fieldDef: x[1] as FieldDefinition<MODEL[keyof MODEL]>,
                };
              })
              .filter(value => value.fieldDef.control.dirty)
              .forEach(dirtyField => {
                event[dirtyField.fieldName] =
                  `${dirtyField.fieldDef.control.value}` as MODEL[keyof MODEL];
              });
          }

          this.authService
            .getAccessTokenSilently()
            .pipe(
              switchMap(token => {
                return this.requestPipe<MODEL>(
                  this.httpClient.post(path, event, {
                    ...this.httpOptions,
                    headers: new HttpHeaders({
                      ...this.httpHeaders,
                      Authorization: `Bearer ${token}`,
                    }),
                  })
                );
              }),
              take(1)
            )
            .subscribe(resource => {
              if (resource?.errors && resource.errors.length > 0) {
                resource.errors.forEach(error => {
                  this.messageService.add({
                    severity: 'error',
                    summary: 'Failed to update!',
                    detail: error.error,
                  });
                });
              } else {
                this.messageService.add({
                  severity: 'success',
                  summary: 'Success!',
                  detail: this.resourceName + ' has been successfully updated.',
                });
              }

              this.clearValue();
            });
        }),
        take(1)
      )
      .subscribe();
  }

  fetchResource(): void {
    this.apiObservable
      .pipe(
        map((api: ApiRoot) => {
          if (!this.settings.resource) throw Error('Resource not configured');

          const primaryIdentifier = this.resolvePrimaryIdentifier(api);
          if (primaryIdentifier && primaryIdentifier != '') {
            if (!this.route.snapshot.paramMap.has(primaryIdentifier)) {
              return;
            }
          }

          const pathIds: Map<string, string> = new Map();
          this.resolvePathIdentifiers(api)?.forEach(pid => {
            if (this.route.snapshot.paramMap.has(pid)) {
              pathIds.set(pid, this.route.snapshot.paramMap.get(pid) as string);
            }
          });

          const { path } = buildPath(
            this.settings.resource.resolvePath(api),
            pathIds
          );

          this.authService.isAuthenticated$
            .pipe(
              switchMap(hasAuth => {
                if (!hasAuth) {
                  return this.requestPipe<MODEL>(
                    this.httpClient.get(path, this.httpOptions)
                  );
                } else {
                  return this.authService.getAccessTokenSilently().pipe(
                    switchMap(token => {
                      return this.requestPipe<MODEL>(
                        this.httpClient.get(path, {
                          ...this.httpOptions,
                          headers: new HttpHeaders({
                            ...this.httpHeaders,
                            Authorization: `Bearer ${token}`,
                          }),
                        })
                      );
                    }),
                    take(1)
                  );
                }
              }),
              take(1)
            )
            .subscribe(resource => {
              this.resource = resource.data;
              this.apiErrors = [...this.apiErrors, ...resource.errors];

              if (
                resource.errors.some(
                  e => e.code === ErrorCode.ResourceNotFoundException
                )
              ) {
                if (this.settings.resource?.onResourceNotFound == 'ERROR') {
                  throw Error(
                    `Resource not found: ${JSON.stringify(resource)}`
                  );
                } else {
                  this.fieldState = 'CREATE';
                  this.patchFormValues(undefined as any);
                }
              } else {
                this.fieldState = 'EDIT';
                this.patchFormValues(resource.data);
              }
            });
        }),
        take(1)
      )
      .subscribe();
  }

  fetchListing(searchDefinition?: SearchMeta<MODEL>): void {
    this.apiObservable
      .pipe(
        map((api: ApiRoot) => {
          if (!this.settings.listable) throw Error('Listing not configured');

          const primaryIdentifier = this.resolvePrimaryIdentifier(api);
          if (primaryIdentifier && primaryIdentifier != '') {
            if (this.route.snapshot.paramMap.has(primaryIdentifier)) {
              return;
            }
          }

          if (searchDefinition) {
            this.searchMetaDataMap.set(
              searchDefinition.field,
              searchDefinition
            );

            if (
              searchDefinition.control.value == '' &&
              searchDefinition.orderControl.value === null
            ) {
              this.searchMetaDataMap.delete(searchDefinition.field);
            }
          }

          const pathIds: Map<string, string> = new Map();
          this.resolvePathIdentifiers(api)?.forEach(pid => {
            if (this.route.snapshot.paramMap.has(pid)) {
              pathIds.set(pid, this.route.snapshot.paramMap.get(pid) as string);
            }
          });

          const { path, pathParamsStarted } = buildPath<MODEL>(
            this.settings.listable.resolvePath(api),
            pathIds,
            this.searchMetaDataMap
          );

          let pagedPath = path;
          if (this.listingCursor && path === this.listingLastPath) {
            pagedPath += pathParamsStarted ? '&' : '?';
            pagedPath += 'p=' + this.listingCursor.next;
          }

          if (this.listingLastPath == path && this.listingCursor == undefined) {
            return;
          }

          this.isLoading = true;

          this.authService.isAuthenticated$
            .pipe(
              switchMap(hasAuth => {
                if (!hasAuth) {
                  return this.requestPipe<PageResponse<MODEL>>(
                    this.httpClient.get(pagedPath, this.httpOptions)
                  );
                } else {
                  return this.authService.getAccessTokenSilently().pipe(
                    switchMap(token => {
                      return this.requestPipe<PageResponse<MODEL>>(
                        this.httpClient.get(pagedPath, {
                          ...this.httpOptions,
                          headers: new HttpHeaders({
                            ...this.httpHeaders,
                            Authorization: `Bearer ${token}`,
                          }),
                        })
                      );
                    }),
                    take(1)
                  );
                }
              }),
              take(1)
            )
            .subscribe(resource => {
              this.apiErrors = [...this.apiErrors, ...resource.errors];

              if (this.listingLastPath === path) {
                if (this.listing) {
                  this.listing = [...this.listing, ...resource.data.page];
                } else {
                  this.listing = resource.data.page;
                }
              } else {
                this.listing = resource.data?.page;
              }

              this.listingLastPath = path;
              this.listingCursor = resource.data?.cursor;

              if (this.afterLoadListing) {
                this.afterLoadListing();
              }

              this.isLoading = false;
            });
        })
      )
      .subscribe();
  }

  private setupInitActions(): void {
    if (this.settings.resource && this.settings.resource.onInitAction) {
      this.fetchResource();
    }
    if (this.settings.listable && this.settings.listable.onInitAction) {
      this.fetchListing();
    }
  }

  ngOnInit(): void {
    this.setupSearchSubscribers();
    this.setupInitActions();
  }
}
