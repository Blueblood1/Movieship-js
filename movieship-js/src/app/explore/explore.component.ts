import { Component, OnInit } from '@angular/core';
import {
  ApiRoot,
  FieldLogic,
  FieldLogicComponent,
  IFieldLogicSettings,
  SearchMetaField,
  SearchLogic,
  SearchFilterTypeNames,
} from '../../logic/field-logic.component';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '@auth0/auth0-angular';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';

export interface ExploreModel {
  imdb_id: string;
  titleType: string;
  primaryTitle: string;
  originalTitle: string;
  startYear: number;
  endYear: number;
  runtimeMinutes: number;
  genres: string[];
  averageRating: number;
  averageRatingVotes: number;
  poster: string;
}

@Component({
  selector: 'app-explore-component',
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.scss'],
})
export class ExploreComponent
  extends FieldLogicComponent<ExploreModel>
  implements OnInit
{
  constructor(
    httpClient: HttpClient,
    authService: AuthService,
    router: Router,
    activatedRoute: ActivatedRoute,
    messageService: MessageService
  ) {
    super(httpClient, authService, router, activatedRoute, messageService);
  }

  onShare() {
    navigator.clipboard.writeText(window.location.href);
  }

  resourceName = 'Explore';

  afterLoadListing = undefined;
  afterCreate = undefined;

  expanded = false;

  baseValue = () => ({} as ExploreModel);

  resolvePathIdentifiers = (api: ApiRoot) => api.EXPLORE_PATH_IDENTIFIERS;
  resolvePrimaryIdentifier = (api: ApiRoot) => api.EXPLORE_PRIMARY_IDENTIFIER;

  settings: IFieldLogicSettings = {
    listable: {
      type: 'LISTABLE',
      resolvePath: api => api.EXPLORE_LISTING,
      onInitAction: true,
    },
    resource: {
      type: 'RESOURCE',
      resolvePath: api => api.EXPLORE_RESOURCE,
      onResourceNotFound: 'ERROR',
      onInitAction: true,
    },
  };

  fieldLogic: FieldLogic<ExploreModel> = {};

  searchLogic: SearchLogic<ExploreModel> = {
    imdb_id: {
      field: 'imdb_id',
      control: new FormControl(''),
      orderControl: new FormControl(null),
      filterControl: new FormControl({ name: SearchFilterTypeNames.LIKE }),
      config: {
        orderAsc: true,
        orderDesc: true,
        enableLike: true,
        enableILike: true,
        enableEquivalent: true,
      },
    },
    primaryTitle: {
      field: 'primaryTitle',
      control: new FormControl(''),
      orderControl: new FormControl(null),
      filterControl: new FormControl({ name: SearchFilterTypeNames.LIKE }),
      config: {
        orderAsc: true,
        orderDesc: true,
        enableLike: true,
        enableILike: true,
        enableEquivalent: true,
      },
    },
    titleType: {
      field: 'titleType',
      control: new FormControl(''),
      orderControl: new FormControl(null),
      filterControl: new FormControl({ name: SearchFilterTypeNames.LIKE }),
      config: {
        orderAsc: true,
        orderDesc: true,
        enableLike: true,
        enableILike: true,
        enableEquivalent: true,
      },
    },
  };

  onScroll = () => {
    this.fetchListing();
  };
}
