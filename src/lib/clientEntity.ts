//
// _______        _______   __   _____     ______  ___      ___                                                  ________         ___      __________
// |      \      /      |  |__|  |    \    |    |  \  \    /  /   ___________    ___________      __________   _|        |__     /   |    |  ____    |
// |       \    /       |   __   |     \   |    |   \  \  /  /    |   _______|   |   _______|    |  ____    |  |           |    /_   |    |__|  |    |
// |        \__/        |  |  |  |      \  |    |    \  \/  /     |  |_______    |  |_______     |__|   /   |  |_          |      |  |       ___|    |
// |     |\      /|     |  |  |  |   |\  \ |    |     |    |      |   _______|   |   _______|          /   /     |______   |      |  |     _|___     |
// |     | \____/ |     |  |  |  |   | \  \|    |     |    |      |  |_______    |  |_______      ____/   /__           |  |   ___|  |__  |  |__|    |
// |_____|        |_____|  |__|  |___|  \_______|     |____|      |__________|   |__________|    |___________|          |__|  |_________| |__________|
//
//
import { Actor, ActorDefinitionIdentifier, ActorRuntimeID, ActorUniqueID } from "bdsx/bds/actor";
import { ItemUseOnActorInventoryTransaction } from "bdsx/bds/inventory";
import { AddActorPacket, RemoveActorPacket } from "bdsx/bds/packets";
import { Player, ServerPlayer } from "bdsx/bds/player";
import { MinecraftPacketIds } from "bdsx/bds/packetids";
import { preventRepeat } from "./preventRepeat";
import { bedrockServer } from "bdsx/launcher";
import { Vec2, Vec3 } from "bdsx/bds/blockpos";
import { procHacker } from "bdsx/prochacker";
import { void_t } from "bdsx/nativetype";
import { events } from "bdsx/event";
import { Event } from "bdsx/eventtarget";

//??0EntityContext@@QEAA@AEAVEntityRegistry@@VEntityId@@@Z

interface EntityData {
    rotation?: Vec2,
    spawnEvent?: string,
}

const clientEntityData = Symbol("clientEntityData");

declare module "bdsx/bds/player" {
    interface Player {
        [clientEntityData]: Map<ActorUniqueID, ActorRuntimeID>;
    }
}


export const removeActor = procHacker.js("?remove@Actor@@UEAAXXZ", void_t, null, Actor);

const addActorPacket$addActorPacket = procHacker.js("??0AddActorPacket@@QEAA@AEAVActor@@@Z", void_t, null, AddActorPacket, Actor);
const removeActorPacket$removeActorPacket = procHacker.js("??0RemoveActorPacket@@QEAA@UActorUniqueID@@@Z", void_t, null, RemoveActorPacket, ActorUniqueID);

export function getClientRuntimeId(player: Player, clientEntityId: ActorUniqueID): ActorRuntimeID | undefined {
    if (!player[clientEntityData]) return;
    return player[clientEntityData].get(clientEntityId);
}
export function createClientEntity(pl: Player, entity_identifier: string | EntityId, pos: Vec3, handling = (actor: Actor) => {}, entityData: EntityData = {}): ActorUniqueID {
    if (!pl[clientEntityData] || !pl?.ctxbase.isValid()) return "";
    const identifier = ActorDefinitionIdentifier.constructWith(entity_identifier);
    if (entityData.spawnEvent) identifier.initEvent = entityData.spawnEvent;
    const actor = Actor.summonAt(pl.getRegion(), pl.getPosition(), identifier, bedrockServer.level.getNewUniqueID());
    const pkt = AddActorPacket.allocate();
    pkt.destruct();

    if (!actor?.ctxbase.isValid()) return "";
    handling(actor);

    addActorPacket$addActorPacket(pkt, actor);

    const uniqueId = pkt.entityId;
    pl[clientEntityData].set(uniqueId, actor.getRuntimeID());

    if (entityData.rotation) {
        pkt.rot.set(entityData.rotation);
        pkt.headYaw = entityData.rotation.y;
    }
    pkt.pos.set({
        x: pos.x + 0.5,
        y: pos.y,
        z: pos.z + 0.5
    });

    actor.remove();
    pl.sendPacket(pkt);
    pkt.dispose();
    return uniqueId;
}

events.playerJoin.on((ev)=>{
    ev.player[clientEntityData] = new Map<ActorUniqueID, ActorRuntimeID>();
});

events.packetAfter(MinecraftPacketIds.InventoryTransaction).on((pkt, target)=>{
    if (pkt.transaction?.isItemUseOnEntityTransaction()) {
        const player = target.getActor();
        if (!player) return;

        if (bedrockServer.level.getRuntimeEntity(pkt.transaction.runtimeId)) return;

        if (preventRepeat(player)) return;

        onHitClientEntity.fire(pkt.transaction, player);
    }
});

export function deleteClientEntity(pl: Player, uniqueId: ActorUniqueID){
    if (uniqueId === "") return;

    if (pl[clientEntityData].has(uniqueId)) pl[clientEntityData].delete(uniqueId);
    const pk = RemoveActorPacket.allocate();
    pk.destruct();
    removeActorPacket$removeActorPacket(pk, uniqueId);
    pl.sendPacket(pk);
    pk.dispose();
}

export function deleteAllEntities(player: Player) {
    if (!player[clientEntityData]) return;
    player[clientEntityData].forEach((_runtimeId, uniqueId) => {
        deleteClientEntity(player, uniqueId)
    });
}

export const onHitClientEntity = new Event<(pkt: ItemUseOnActorInventoryTransaction, player: ServerPlayer)=>void>();