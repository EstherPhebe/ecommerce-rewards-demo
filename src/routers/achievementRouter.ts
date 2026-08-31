import express from "express";
import { getUserAchievements } from "../controllers/achievementController";

const achievementRouter = express.Router();

achievementRouter.route("/users/:userId/achievements").get(getUserAchievements);

export default achievementRouter;
