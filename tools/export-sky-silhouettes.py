"""Export tower silhouettes for inexpensive Canvas sky attenuation."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
out=ROOT/'assets/poseidon-space-arena'
bpy.ops.wm.open_mainfile(filepath=str(out/'arena.blend'))
o=bpy.data.objects['Arena_Columns_Props_Towers']
groups={g.index:[] for g in o.vertex_groups if g.name.startswith('Atmosphere_Tower_')}
for v in o.data.vertices:
 for g in v.groups:
  if g.group in groups and g.weight>.5:
   p=o.matrix_world@v.co;groups[g.group].append((p.x,p.z,-p.y));break
bounds=[]
for points in groups.values():
 if points:bounds.append([[round(min(p[a] for p in points),5) for a in range(3)],[round(max(p[a] for p in points),5) for a in range(3)]])
(out/'sky-silhouettes.json').write_text(json.dumps(bounds),encoding='utf-8')
print('Sky silhouette boxes:',len(bounds))
