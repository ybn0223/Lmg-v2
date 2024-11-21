declare module 'connect-mongodb-session' {
    import session from 'express-session';
    import { ConnectionOptions } from 'mongoose';
  
    class MongoDBStore extends session.Store {
      constructor(options: MongoDBStoreOptions);
      on(event: string, callback: (error: any) => void): void;
    }
  
    interface MongoDBStoreOptions {
      uri: string;
      databaseName?: string;
      collection: string;
      connectionOptions?: ConnectionOptions;
      expires?: number;
      idField?: string;
    }
  
    export = MongoDBStore;
  }  