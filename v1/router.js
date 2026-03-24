import express from "express";
import { analyzeJsRepository } from "./controller/analyzer.js";

const routerV1 = express.Router();

routerV1.post("/analyze-js", analyzeJsRepository);

export default routerV1;
