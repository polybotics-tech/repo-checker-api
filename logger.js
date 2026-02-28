import nodeFileLogger from "node-file-logger";

nodeFileLogger.SetUserOptions({
  timeZone: "Africa/Lagos",
  folderPath: "./logs/",
  dateBasedFileNaming: true,
  fileNamePrefix: "log_",
  fileNameExtension: ".log",
  dateFormat: "YYYY_MM_D",
  timeFormat: "h:mm:ss A",
  onlyFileLogging: true, // set to 'false' to log to console during development
});

export const logbot = nodeFileLogger;
