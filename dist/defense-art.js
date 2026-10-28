// Defense changes the entire character atlas, including status masks and defeat poses.
export function characterAtlas(art,id,actor){
 const defended=actor&&((id==='dario'&&actor.shield>0)||(id==='jensen'&&actor.armor>0));
 return (defended&&art.defenseAnimations?.[id])||art.animations?.[id];
}
