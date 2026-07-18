CREATE UNIQUE INDEX `Document_client_mydata_mark_key`
  ON `Document`(`clientCompanyId`, `myDataMark`);

CREATE UNIQUE INDEX `Document_client_mydata_uid_key`
  ON `Document`(`clientCompanyId`, `myDataUid`);
