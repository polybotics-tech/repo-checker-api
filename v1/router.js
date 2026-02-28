import express from "express";
import { analyzeRepository } from "./controller/analyzer.js";

const routerV1 = express.Router();

routerV1.post("/analyze", analyzeRepository);

export default routerV1;
