export type AnalyticsEvent = 
  | 'user.signup'
  | 'user.login'
  | 'bookmark.create'
  | 'bookmark.delete'
  | 'bookmark.import'
  | 'bookmark.export'
  | 'collection.create'
  | 'collection.delete'
  | 'tag.create'
  | 'search.execute'
  | 'settings.update';

export interface TrackEventOptions {
  eventName: AnalyticsEvent;
  eventData?: Record<string, string | number | boolean>;
}

export interface IdentifyUserOptions {
  userId: string;
  userData?: {
    name?: string;
    email?: string;
    [key: string]: string | number | boolean | undefined;
  };
}

export interface PageViewOptions {
  url: string;
  referrer?: string;
}
