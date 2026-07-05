process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://openlog:openlog_password@localhost:3306/open_logistirio_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-change-me';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-change-me';
process.env.FRONTEND_ORIGIN = 'http://localhost:4200';
process.env.AADE_MYDATA_ENV = 'test';
process.env.AADE_MYDATA_TEST_SEND_INVOICES_URL = 'https://mydataapidev.aade.gr/SendInvoices';
