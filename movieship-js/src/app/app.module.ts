import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { MenubarModule } from 'primeng/menubar';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PasswordModule } from 'primeng/password';
import { DividerModule } from 'primeng/divider';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { AuthModule } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';
import { ExploreComponent } from './explore/explore.component';
import { ProfileComponent } from './profile/profile.component';
import { ReviewComponent } from './comment/review.component';
import { InputSwitchModule } from 'primeng/inputswitch';
import { RatingModule } from 'primeng/rating';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TimeagoModule } from 'ngx-timeago';
import { InplaceModule } from 'primeng/inplace';
import { TabViewModule } from 'primeng/tabview';
import { TriStateCheckboxModule } from 'primeng/tristatecheckbox';
import { BadgeModule } from 'primeng/badge';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { DropdownModule } from 'primeng/dropdown';
import { WatchlistCompactComponent } from './watchlist-compact/watchlist-compact.component';
import { WatchlistComponent } from './watchlist/watchlist.component';
import { CarouselModule } from 'primeng/carousel';
import { ChipModule } from 'primeng/chip';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@NgModule({
  declarations: [
    AppComponent,
    ExploreComponent,
    ProfileComponent,
    ReviewComponent,
    WatchlistComponent,
    WatchlistCompactComponent,
  ],
  imports: [
    TimeagoModule.forRoot(),
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    MenubarModule,
    InputTextModule,
    ReactiveFormsModule,
    FormsModule,
    PasswordModule,
    DividerModule,
    BrowserAnimationsModule,
    InfiniteScrollModule,
    InputSwitchModule,
    AuthModule.forRoot({
      domain: environment.config.auth0_domain,
      clientId: environment.config.auth0_clientId,
      audience: environment.config.auth0_audience,
      redirectUri: environment.config.baseUrl,
    }),
    RatingModule,
    SelectButtonModule,
    InplaceModule,
    TabViewModule,
    TriStateCheckboxModule,
    BadgeModule,
    InputTextareaModule,
    ConfirmDialogModule,
    OverlayPanelModule,
    DropdownModule,
    CarouselModule,
    ChipModule,
    ToastModule,
    ProgressSpinnerModule,
  ],
  providers: [MessageService, ConfirmationService],
  bootstrap: [AppComponent],
})
export class AppModule {}
