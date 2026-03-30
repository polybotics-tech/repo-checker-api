import express from "express";
import { analyzeRepository } from "./controller/analyzer.js";

const routerV1 = express.Router();

routerV1.post("/analyze", analyzeRepository);
routerV1.post("/analyze-js", analyzeRepository); // keeping as alias

export default routerV1;
