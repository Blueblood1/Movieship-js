import { Component, Input, OnInit } from '@angular/core';
import {
  ApiRoot,
  FieldLogic,
  FieldLogicComponent,
  IFieldLogicSettings,
  SearchMetaField,
  SearchLogic,
} from '../../logic/field-logic.component';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '@auth0/auth0-angular';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ExploreModel } from '../explore/explore.component';

export interface WatchlistModel {
  _id?: string;
  title: string;
  watchlist: string[];
  watchlist_movies: ExploreModel[];
}

@Component({
  selector: 'app-watchlist-component',
  templateUrl: './watchlist.component.html',
  styleUrls: ['./watchlist.component.scss'],
  providers: [ConfirmationService],
})
export class WatchlistComponent
  extends FieldLogicComponent<WatchlistModel>
  implements OnInit
{
  constructor(
    httpClient: HttpClient,
    authService: AuthService,
    router: Router,
    activatedRoute: ActivatedRoute,
    private confirmationService: ConfirmationService,
    messageService: MessageService
  ) {
    super(httpClient, authService, router, activatedRoute, messageService);
  }

  resourceName = 'Watchlist';

  selectedResourceHasMovie() {
    if (this.resource && this.resource._id) {
      if (
        this.resource.watchlist &&
        this.resource.watchlist.some(watched => watched === this.imdb_id)
      ) {
        return 'REMOVE';
      }
      return 'ADD';
    }

    return 'HIDE';
  }

  watchlistPlaceholder: WatchlistModel = {
    title: '',
    watchlist: [],
    watchlist_movies: [],
  };

  afterCreate = (resource?: WatchlistModel) => {
    if (resource && resource._id) {
      this.selectedResourceIdentifiers.set('watchlist_id', resource?._id);
    }
  };

  override onDelete() {
    super.onDelete();
    this.fieldLogic.title?.control.reset('');
  }

  afterLoadListing = () => {
    if (this.selectedResourceIdentifiers.has('watchlist_id')) {
      const id = this.selectedResourceIdentifiers.get('watchlist_id');

      const resource = this.listing?.find(l => l._id == id);

      if (resource) {
        this.resource = resource;
        this.fieldState = 'EDIT';
        this.fieldLogicFormGroup.reset(resource as any);
      }
    }
  };

  selectResource(resource: WatchlistModel): (any: any) => void {
    return (event: any) => {
      if (resource?._id) {
        this.selectedResourceIdentifiers.set('watchlist_id', resource._id);
      }
      this.resource = resource;
      this.fieldLogicFormGroup.reset(resource as any);
      this.fieldState = 'EDIT';
    };
  }

  onCreateListItem() {
    if (this.resource?._id) {
      this.selectedResourceIdentifiers.delete('watchlist_id');
    }
    this.resource = this.watchlistPlaceholder;
    this.fieldLogicFormGroup.reset(this.watchlistPlaceholder as any);
    this.fieldState = 'CREATE';
  }

  confirmDeleteWatchlist() {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this watchlist?',
      accept: () => {
        this.onDelete();
      },
    });
  }

  resolvePathIdentifiers = (api: ApiRoot) => api.WATCHLIST_PATH_IDENTIFIERS;
  resolvePrimaryIdentifier = (api: ApiRoot) => api.WATCHLIST_PRIMARY_IDENTIFIER;

  @Input() imdb_id = '';
  @Input() compact = true;

  settings: IFieldLogicSettings = {
    resource: {
      type: 'RESOURCE',
      resolvePath: api => api.WATCHLIST_RESOURCE,
      onResourceNotFound: 'ERROR',
    },
    creatable: {
      type: 'CREATABLE',
      resolvePath: api => api.WATCHLIST_CREATE,
    },
    updatable: {
      type: 'UPDATABLE',
      resolvePath: api => api.WATCHLIST_UPDATE,
    },
    listable: {
      type: 'LISTABLE',
      resolvePath: api => api.WATCHLIST_LISTING,
      onInitAction: true,
    },
    destroyable: {
      type: 'DESTROYABLE',
      resolvePath: api => api.WATCHLIST_DELETE,
    },
  };

  fieldLogic: FieldLogic<WatchlistModel> = {
    title: {
      control: new FormControl('', [
        Validators.required,
        Validators.minLength(4),
      ]),
      enableCreate: true,
      enableUpdate: false,
    },
    watchlist_movies: {
      control: new FormControl([]),
      enableCreate: true,
      enableUpdate: false,
    },
  };

  searchControl: Map<keyof WatchlistModel, SearchMetaField> = new Map();

  searchLogic: SearchLogic<WatchlistModel> = {};

  onScroll = () => {
    this.fetchListing();
  };

  baseValue = () => ({} as WatchlistModel);
}
