import { createDirectories, fromRawtext, getHolograms, holograms, ScoreHologram, TextHologram, toAllPlayers } from "./lib/Utils";
import { createClientEntity, deleteAllEntities } from "./lib/clientEntity";
import { bedrockServer } from "bdsx/launcher";
import { ServerPlayer } from "bdsx/bds/player";
import { copyFileSync } from "fs";
import { Scoreboard } from "bdsx/bds/scoreboard";
import { events } from "bdsx/event";
import { Actor } from "bdsx/bds/actor";
import { Level } from "bdsx/bds/level";
import { Vec3 } from "bdsx/bds/blockpos";
import { join } from "path";
import "./commands";

export let level: Level;
export let scoreboard: Scoreboard;

copyFileSync(join(__dirname, 'entity.json'), join(process.cwd(), 'behavior_packs/vanilla_1.20.50/entities/ender_crystal.json'));
createDirectories();

events.serverOpen.on(() => {
    level = bedrockServer.level;
    scoreboard = level.getScoreboard();

    getHolograms().forEach(({ name, type, content, position: pos }) => {
        if (type === "raw") return TextHologram.create(name, type, content, pos.x, pos.y, pos.z).save();
        ScoreHologram.create(name, type, content, pos.x, pos.y, pos.z).save();
    });

    const interval = setInterval(() => {
        if (bedrockServer.isClosed()) return clearInterval(interval);

        toAllPlayers((player: ServerPlayer) => {
            if (!player.isSpawned() || player.isLoading() || player.isNull()) return;
            deleteAllEntities(player);

            holograms.forEach((hologram) => {
                const { x, y, z } = hologram.getPosition();
                let lines: string[] = [];
                if (hologram.isScore()) {
                    lines.push(hologram.displayName, '');
                    lines = lines.concat(hologram.scores.map(({ gamertag, score }) => `${gamertag}:   ${score}`));
                }
                if (hologram.isText()) lines = fromRawtext(hologram.content, player).split("\n");
                lines.reverse();

                for (let i = 0; i < lines.length; i++) {
                    const position = Vec3.create(x, y + ( 0.3 * i ), z);

                    createClientEntity(player, 'minecraft:ender_crystal', position, (entity: Actor) => {
                        if (lines[i] !== '') entity.setNameTag(lines[i]);
                    }, {
                        spawnEvent: 'scoreboard'
                    });
                }
            });
        });
    }, 1000);
});