import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  constructor(public auth: AuthService) {}

  title = 'movieship-js';

  items: MenuItem[] = [];

  preview = '';

  ngOnInit(): void {
    this.items = [
      {
        label: 'Explore',
        icon: 'pi pi-fw pi-search',
        routerLink: [''],
      },
    ];

    this.auth.isAuthenticated$.subscribe(authenticated => {
      if (authenticated) {
        this.items = [
          ...this.items,
          {
            label: 'Profile',
            icon: 'pi pi-fw pi-user',
            routerLink: ['profile'],
          },
          {
            label: 'Sign out',
            icon: 'pi pi-fw pi-sign-out',
            command: () =>
              this.auth.logout({
                returnTo: environment.config.baseUrl,
              }),
          },
        ];
      } else {
        this.items = [
          ...this.items,
          {
            label: 'Sign in',
            icon: 'pi pi-fw pi-sign-in',
            command: () => this.auth.loginWithRedirect(),
          },
          {
            label: 'Sign up',
            icon: 'pi pi-fw pi-user-plus',
            command: () => this.auth.loginWithRedirect(),
          },
        ];
      }
    });
  }
}
