import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MyDataApiService } from './core/api/mydata-api.service';
import { AppComponent, isBarePath } from './app.component';

describe('AppComponent', () => {
  it('creates the app', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('uses the browser location during initial navigation so setup never creates the shell', async () => {
    const location = jasmine.createSpyObj<Location>('Location', ['path']);
    const myDataApi = jasmine.createSpyObj<MyDataApiService>('MyDataApiService', ['environment']);
    location.path.and.returnValue('/setup');

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: Location, useValue: location },
        { provide: MyDataApiService, useValue: myDataApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.isBareRoute()).toBeTrue();
    expect(myDataApi.environment).not.toHaveBeenCalled();
  });
});

describe('isBarePath', () => {
  it('recognizes login and setup paths without treating authenticated pages as bare', () => {
    expect(isBarePath('/login')).toBeTrue();
    expect(isBarePath('/setup?source=installer')).toBeTrue();
    expect(isBarePath('/')).toBeFalse();
    expect(isBarePath('/settings')).toBeFalse();
  });
});
