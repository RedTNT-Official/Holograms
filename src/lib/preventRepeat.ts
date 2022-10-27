import { ServerPlayer } from "bdsx/bds/player";
import { events } from "bdsx/event";

const repeat = new Map<string, number>();

export function preventRepeat(player:ServerPlayer) {
    const date = Date.now();

    const time = repeat.get(player.getName());
    if (time && date < time) {
        repeat.set(player.getName(), date + 1000);
        return true;
    }
    else {
        repeat.set(player.getName(), date + 1000);
    }

    return false;
}

events.playerLeft.on((ev)=>{
    const playerName = ev.player.getName();

    if (repeat.has(playerName)) repeat.delete(playerName);
});