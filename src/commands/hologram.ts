import { getHolograms, getTemplates, holograms, RawText, ScoreHologram, Template, TextHologram } from "../lib/Utils";
import { CommandPermissionLevel, CommandPosition } from "bdsx/bds/command";
import { JsonValue } from "bdsx/bds/connreq";
import { CxxString } from "bdsx/nativetype";
import { command } from "bdsx/command";
import { events } from "bdsx/event";


events.serverOpen.on(() => {

    const cmd = command.register('hologram', 'Hologram command', CommandPermissionLevel.Operator);

    cmd.overload((param, origin, output) => {
        const name = param.name;
        const { x, y, z } = param.pos || origin.getEntity()?.getFeetPos()!;

        ScoreHologram.create(name, "score", param.objective, x, y, z).save();

        output.success('Hologram created');
    }, {
        create: command.enum('option.create', 'create'),
        score: command.enum('option.score', 'score'),
        name: CxxString,
        objective: CxxString,
        pos: [CommandPosition, true]
    });

    cmd.overload((param, origin, output) => {
        const name = param.name;
        const raw: RawText = param.content.value();
        console.log(raw);
        const { x, y, z } = param.pos || origin.getEntity()?.getFeetPos()!;

        TextHologram.create(name, "raw", raw.rawtext, x, y ,z).save();
        output.success('Hologram created');
    }, {
        create: command.enum('option.create', 'create'),
        text: command.enum('option.raw', 'raw'),
        name: CxxString,
        content: JsonValue,
        pos: [CommandPosition, true]
    });

    cmd.overload((param, origin, output) => {
        const name = param.name;
        const template = getTemplates().find((template: Template) => template.template_name.toLowerCase() === param.template.toLowerCase());
        if (!template) return output.error('Template not found');

        const { x, y, z } = param.pos || origin.getEntity()?.getFeetPos()!;
        if (template.type === "raw") TextHologram.from(template, name, x, y , z).save();
        else ScoreHologram.from(template, name, x, y , z).save();

        output.success('Hologram created');
    }, {
        create: command.enum('option.create', 'create'),
        text: command.enum('option.template', 'template'),
        name: CxxString,
        template: CxxString,
        pos: [CommandPosition, true]
    });

    cmd.overload((param, origin, output) => {
        const name = param.name;
        const hologram = holograms.get(name);
        if (!hologram) return output.error('Hologram not found');

        const { x, y, z } = param.pos || origin.getEntity()?.getFeetPos()!;
        hologram.setPosition(x, y, z);

        output.success('Hologram moved');
    }, {
        move: command.enum('option.move', 'move'),
        name: CxxString,
        pos: [CommandPosition, true]
    });

    cmd.overload((param, _origin, output) => {
        const name = param.name;
        const hologram = holograms.get(name);
        if (!hologram) return output.error(`Can't find the "${param.name}" hologram`);

        hologram.remove();

        output.success(`"${name}" hologram has been removed`);
    }, {
        remove: command.enum('option.remove', 'remove'),
        name: CxxString
    });

    cmd.overload((_param, _origin, output) => {
        if (holograms.size === 0) return output.error(`There are not active holograms`);

        holograms.forEach(hologram => hologram.remove());

        output.success(`All holograms has been removed`);
    }, {
        remove: command.enum('option.removeall', 'removeall')
    });

    cmd.overload((_param, _origin, output) => {
        const list = getHolograms().map(hologram => `- ${hologram.name}`);
        output.success(`There are ${list.length} active holograms:\n` + list.join('\n'));
    }, {
        list: command.enum('option.list', 'list')
    });
});