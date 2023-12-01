import { Component, OnInit } from '@angular/core';
import {
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
import { MessageService } from 'primeng/api';

export interface Watchlist {
  imdb_ids: string[];
  title: string;
}

export interface ProfileModel {
  name: string;
  watchlist: Watchlist[];
}

@Component({
  selector: 'app-profile-component',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent
  extends FieldLogicComponent<ProfileModel>
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

  resourceName = 'Profile';

  afterLoadListing = undefined;
  afterCreate = undefined;

  baseValue = () => ({} as ProfileModel);

  resolvePathIdentifiers = () => undefined;
  resolvePrimaryIdentifier = () => undefined;

  settings: IFieldLogicSettings = {
    resource: {
      type: 'RESOURCE',
      resolvePath: api => api.PROFILE_RESOURCE,
      onResourceNotFound: 'CREATE',
      onInitAction: true,
    },
    creatable: {
      type: 'CREATABLE',
      resolvePath: api => api.PROFILE_CREATE,
    },
    updatable: {
      type: 'UPDATABLE',
      resolvePath: api => api.PROFILE_UPDATE,
    },
  };

  fieldLogic: FieldLogic<ProfileModel> = {
    name: {
      control: new FormControl('', [
        Validators.required,
        Validators.minLength(4),
      ]),
      enableCreate: false,
      enableUpdate: false,
    },
  };

  searchControl: Map<keyof ProfileModel, SearchMetaField> = new Map();

  searchLogic: SearchLogic<ProfileModel> = {};
}
