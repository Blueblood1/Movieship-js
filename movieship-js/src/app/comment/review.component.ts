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

export interface ReviewModel {
  imdb_id: string;
  comment: string;
  rating: number;
  user: string;
  timestamp: string;
  username: string;
}

@Component({
  selector: 'app-comment-component',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.scss'],
  providers: [],
})
export class ReviewComponent
  extends FieldLogicComponent<ReviewModel>
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

  resourceName = 'Review';

  afterLoadListing = undefined;
  afterCreate = undefined;

  resolvePathIdentifiers = (api: ApiRoot) => api.REVIEW_PATH_IDENTIFIERS;
  resolvePrimaryIdentifier = () => undefined;

  @Input() imdb_id = '';

  baseValue = () => {
    return {
      imdb_id: this.imdb_id,
    };
  };

  settings: IFieldLogicSettings = {
    resource: {
      type: 'RESOURCE',
      resolvePath: api => api.REVIEW_RESOURCE,
      onResourceNotFound: 'CREATE',
      onInitAction: true,
    },
    creatable: {
      type: 'CREATABLE',
      resolvePath: api => api.REVIEW_CREATE,
    },
    updatable: {
      type: 'UPDATABLE',
      resolvePath: api => api.REVIEW_UPDATE,
    },
    listable: {
      type: 'LISTABLE',
      resolvePath: api => api.REVIEW_LISTING,
      onInitAction: true,
    },
    destroyable: {
      type: 'DESTROYABLE',
      resolvePath: api => api.REVIEW_DELETE,
    },
  };

  fieldLogic: FieldLogic<ReviewModel> = {
    comment: {
      control: new FormControl('', [
        Validators.required,
        Validators.minLength(4),
      ]),
      enableCreate: true,
      enableUpdate: false,
    },
    rating: {
      control: new FormControl(null, [
        Validators.required,
        Validators.max(10),
        Validators.min(0),
      ]),
      enableCreate: true,
      enableUpdate: false,
    },
  };

  searchControl: Map<keyof ReviewModel, SearchMetaField> = new Map();

  searchLogic: SearchLogic<ReviewModel> = {};

  onScroll = () => {
    this.fetchListing();
  };
}
