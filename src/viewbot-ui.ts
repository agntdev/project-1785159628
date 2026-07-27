import { inlineButton, inlineKeyboard } from "./toolkit/index.js";

export const BACK = inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);

export function botMenu() {
  return inlineKeyboard([
    [inlineButton("Add sub-bot", "bots:add")],
    [inlineButton("Remove sub-bot", "bots:remove")],
    [inlineButton("Back to menu", "menu:main")],
  ]);
}
