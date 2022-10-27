import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { Objective, Scoreboard, ScoreboardId } from "bdsx/bds/scoreboard";
import { level, scoreboard } from "..";
import { serverProperties } from "bdsx/serverproperties";
import { ServerPlayer } from "bdsx/bds/player";
import * as yaml from "yaml";
import { Vec3 } from "bdsx/bds/blockpos";
import { join } from "path";
import { bedrockServer } from "bdsx/launcher";
import { CommandResult, CommandResultType } from "bdsx/commandresult";

const hologramsDB: string = join(process.cwd(), 'worlds', serverProperties["level-name"] || 'Bedrock level', 'holograms.json');
const configDir: string = join(process.cwd(), '..', 'config');
const path: string = join(configDir, 'Holograms');
const templatesDir: string = join(path, 'templates');

export const holograms = new Map<string, Hologram>();

export class Hologram {
    name: string;
    type: HologramType;
    content: string | RawComponent[];
    position: Vec3;
    template?: string;

    constructor(name: string, type: HologramType, content: string | RawComponent[], position: Vec3, template?: string) {
        this.name = name;
        this.type = type;
        this.position = position;
        this.template = template;

        if (typeof content === "string" && this.isText()) this.content = [{ text: content }];
        else this.content = content;
    }

    getPosition(): Vec3 {
        return this.position
    }

    setPosition(position: Vec3): this;
    setPosition(x: number, y: number, z: number): this;
    setPosition(a: number | Vec3, b?: number, c?: number): this {
        const v = new Vec3(true);
        if (typeof a === 'number') {
            v.x = a;
            v.y = b!;
            v.z = c!;
        } else {
            v.x = a.x;
            v.y = a.y;
            v.z = a.z;
        }
        this.position = v;
        this.save();
        return this;
    }

    save() {
        holograms.set(this.name, this);

        if (!existsSync(hologramsDB)) writeFileSync(hologramsDB, "[]");

        try {
            const db: HologramDB[] = JSON.parse(readFileSync(hologramsDB, "utf-8"));
            const { x, y, z } = this.position;
            const hologram = {
                name: this.name,
                type: this.type,
                content: this.content,
                position: { x, y, z }
            }
            if (!db.find(({ name }) => name === this.name)) db.push(hologram);
            else for (let i = 0; i < db.length; i++) {
                if (db[i].name === this.name) {
                    db[i] = hologram;
                    break;
                }
            };
            writeFileSync(hologramsDB, JSON.stringify(db, null, 2));
        } catch (e) {
            console.error(e);
        }
    }

    remove() {
        if (holograms.has(this.name)) holograms.delete(this.name);

        if (!existsSync(hologramsDB)) writeFileSync(hologramsDB, "[]");

        try {
            const db: HologramDB[] = JSON.parse(readFileSync(hologramsDB, "utf-8"));
            const index: number = db.findIndex(({ name }) => name === this.name);

            if (index === -1) return;
            db.splice(index, 1);
            writeFileSync(hologramsDB, JSON.stringify(db, null, 2));
        } catch (e) {
            console.error(e);
        }
    }

    isScore(): this is ScoreHologram {
        return this.type === "score";
    }

    isText(): this is TextHologram {
        return this.type === "raw";
    }

    static create(name: string, type: HologramType, content: string | RawComponent[], position: Vec3): Hologram;
    static create(name: string, type: HologramType, content: string | RawComponent[], x: number, y: number, z: number): Hologram;
    static create(name: string, type: HologramType, content: string | RawComponent[], a: number | Vec3, b?: number, c?: number): Hologram {
        const v = new Vec3(true);
        if (typeof a === 'number') {
            v.x = a;
            v.y = b!;
            v.z = c!;
        } else {
            v.x = a.x;
            v.y = a.y;
            v.z = a.z;
        }

        return new this(name, type, content, v);
    }

    static from(template: Template, name: string, position: Vec3): Hologram
    static from(template: Template, name: string, x: number, y: number, z: number): Hologram
    static from(template: Template, name: string, a: number | Vec3, b?: number, c?: number): Hologram {
        const { template_name, type, content } = template;
        const v = new Vec3(true);
        if (typeof a === 'number') {
            v.x = a;
            v.y = b!;
            v.z = c!;
        } else {
            v.x = a.x;
            v.y = a.y;
            v.z = a.z;
        }

        return new this(name, type, content, v, template_name);
    }
}

export class ScoreHologram extends Hologram {
    content: string;
    objective: string

    get displayName(): string {
        this.objective = this.content;
        return scoreboard.getObjective(this.objective)?.displayName || 'Objective not found';
    }

    get scores(): PlayerScore[] {
        this.objective = this.content;
        const scores = getOnlineScores(this.objective);
        if (scores === null) this.objective = 'Objective not found';
        return scores || [];
    }
}

export class TextHologram extends Hologram {
    content: RawComponent[];
}

export function getOnlineScores(objectiveName: string): PlayerScore[] | null {
    const objective: Objective | null = scoreboard.getObjective(objectiveName);
    if (objective === null) return null;

    const scores: PlayerScore[] = [];

    toAllPlayers((player: ServerPlayer) => {
        const id: ScoreboardId = scoreboard.getPlayerScoreboardId(player);
        const score: number = objective?.getPlayerScore(id).value || 0;
        scores.push({
            gamertag: player.getName(),
            score: score
        });
    });

    return scores;
}

export function getAllScores(objectiveName: string): PlayerScore[] {
    const scoreboard: Scoreboard = level.getScoreboard();
    const objective: Objective | null = scoreboard.getObjective(objectiveName);
    const scores: PlayerScore[] = [];

    objective?.getPlayers().forEach((id: ScoreboardId) => {
        const score: number = objective.getPlayerScore(id).value || 0;
        scores.push({
            gamertag: id.identityDef.getName() || 'Unknown',
            score: score
        });
    });

    return scores;
}

export function toAllPlayers(callback: (player: ServerPlayer) => void) {
    level.getPlayers().forEach((player: ServerPlayer) => {
        callback(player);
    });
}

export function getHolograms(): HologramDB[] {
    if (!existsSync(hologramsDB)) writeFileSync(hologramsDB, "[]");
    try {
        return JSON.parse(readFileSync(hologramsDB, 'utf-8'));
    } catch (e) {
        console.error(e);
        return [];
    }
}

export function getTemplates(): Template[] {
    createDirectories();
    try {
        return readdirSync(templatesDir).map((name: string) => yaml.parse(readFileSync(join(templatesDir, name), 'utf-8'))) || [];
    } catch (e) {
        console.error(e);
        return [];
    }
}

const template1: Template = {
    template_name: "Raw template example",
    type: "raw",
    content: [
        {
            text: "First line\nSecond line\nThird line"
        }
    ]
}
const template2: Template = {
    template_name: "Score template example",
    type: "score",
    content: "objective_name"
}

export function fromRawtext(rawtext: any[], player: ServerPlayer): string {
    return rawtext.map((component) => {
        if (component.text) {
            return component.text;
        }

        if (component.translate) {
            return component.translate;
        }

        if (component.score) {
            const score = bedrockServer.level.getScoreboard();
            const objective = score.getObjective(component.score.objective);
            const target = bedrockServer.level.getPlayers().find(player => player.getNameTag() === component.score.name);
            if (!objective || objective === null || !target) return "";

            const scoreId = score.getPlayerScoreboardId(target);
            return objective.getPlayerScore(scoreId).value.toString();
        }

        if (component.selector) {
            const nearestPlayer = player.runCommand(`testfor ${component.selector}`, CommandResultType.Data).data as CommandResult.TestFor;
            if (nearestPlayer.statusCode !== 0) return "";
            return nearestPlayer.victim.join(", ");
        }
        return "";
    }).join("");
}

export function createDirectories() {
    if (!existsSync(configDir)) mkdirSync(configDir);
    if (!existsSync(path)) mkdirSync(path);
    if (!existsSync(templatesDir)) {
        mkdirSync(templatesDir);
        writeFileSync(join(templatesDir, 'template-1.yaml'), yaml.stringify(template1));
        writeFileSync(join(templatesDir, 'template-2.yaml'), yaml.stringify(template2));
    }
}

export interface RawText {
    rawtext: [RawComponent];
}

export type RawComponent = Text | Selector | Translate | Score;

export interface Text {
    text: string;
}

export interface Selector {
    selector: CmdSelector;
    text: string;
}

export interface Translate {
    translate: string;
    with?: string[];
    text: string;
}

export interface Score {
    name: "*" | CmdSelector;
    objective: string;
    text: string;
}

export type CmdSelector = "@a" | "@s" | "@p" | "@r" | string;

export interface HologramDB {
    name: string;
    type: HologramType;
    content: string | RawComponent[];
    position: {
        x: number;
        y: number;
        z: number
    }
}

export interface Template {
    template_name: string;
    type: HologramType;
    content: string | RawComponent[];
}

export type HologramType = 'score' | 'raw';

export interface PlayerScore {
    gamertag: string;
    score: number
}