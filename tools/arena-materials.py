"""Bake dedicated arena maps and construct a seamless, repeating terrain material."""
import bpy, math, shutil, numpy as np

def tile_object(o,material,tile_size):
    o.data.materials.clear();o.data.materials.append(material)
    for uv in list(o.data.uv_layers):o.data.uv_layers.remove(uv)
    uv=o.data.uv_layers.new(name='StoneTile')
    for face in o.data.polygons:
        axis=max(range(3),key=lambda i:abs(face.normal[i]))
        axes=(0,1) if axis==2 else (0,2) if axis==1 else (1,2)
        for loop in face.loop_indices:
            p=o.data.vertices[o.data.loops[loop].vertex_index].co
            uv.data[loop].uv=(p[axes[0]]/tile_size,p[axes[1]]/tile_size)
    o.data.uv_layers.active_index=0;uv.active_render=True

def build(out_dir, floor, hoop, second, standard):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
    scene.render.bake.margin=8;scene.render.bake.use_clear=True
    targets={}
    def final_material(name,images,roughness):
        mat=bpy.data.materials.new(name);mat.use_nodes=True;nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value=roughness;bs.inputs['Metallic'].default_value=0;bs.inputs['Specular IOR Level'].default_value=.2
        for channel,socket in [('BaseColor','Base Color'),('Emissive','Emission Color'),('Roughness','Roughness')]:
            if channel not in images:continue
            tex=nt.nodes.new('ShaderNodeTexImage');tex.image=images[channel];nt.links.new(tex.outputs['Color'],bs.inputs[socket])
        tex=nt.nodes.new('ShaderNodeTexImage');tex.image=images['Normal'];normal=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(tex.outputs['Color'],normal.inputs['Color']);nt.links.new(normal.outputs[0],bs.inputs['Normal'])
        bs.inputs['Emission Strength'].default_value=3 if 'Emissive' in images else 0
        return mat
    specs={
        'polySurface11':('Floor',4096,floor,.9),
        'polySurface14':('Ring',2048,hoop,.84),
        'pTorus3':('SecondRing',2048,second,.84),
    }
    for name,(prefix,size,source,roughness) in specs.items():
        o=bpy.data.objects[name]
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        o.data.uv_layers.new(name='ArenaAtlas');o.data.uv_layers.active_index=len(o.data.uv_layers)-1
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.006)
        bpy.ops.object.mode_set(mode='OBJECT')
        mat,channels,bs,out=source;nt=mat.node_tree;images={}
        for channel in ['BaseColor','Normal']+(['Emissive'] if source!=standard else []):
            img=bpy.data.images.new(prefix+'_'+channel,width=size,height=size,alpha=False)
            if channel=='Normal':img.colorspace_settings.name='Non-Color'
            bake=nt.nodes.new('ShaderNodeTexImage');bake.image=img;nt.nodes.active=bake
            if channel!='Normal':
                emit=nt.nodes.new('ShaderNodeEmission');nt.links.new(channels[channel],emit.inputs[0]);nt.links.new(emit.outputs[0],out.inputs['Surface'])
            else:nt.links.new(bs.outputs[0],out.inputs['Surface'])
            bpy.ops.object.bake(type='NORMAL' if channel=='Normal' else 'EMIT')
            img.filepath_raw=str(out_dir/f'{prefix}_{channel}.png');img.file_format='PNG';img.save();images[channel]=img;targets[prefix+'_'+channel]=img
        o.data.materials.clear();o.data.materials.append(final_material(prefix+' • dry charcoal stone',images,roughness))
        for uv in list(o.data.uv_layers):
            if uv.name!='ArenaAtlas':o.data.uv_layers.remove(uv)
        o.data.uv_layers.active_index=0;o.data.uv_layers[0].active_render=True

    # Periodic noise yields seamless, fine mineral grain at a consistent 4m
    # scale across the large landscape, independent of the overall UV bounds.
    size=2048;rng=np.random.default_rng(81)
    white=rng.normal(size=(size,size)).astype(np.float32)
    fy=np.fft.fftfreq(size)[:,None];fx=np.fft.rfftfreq(size)[None,:]
    radius=fx*fx+fy*fy
    field=np.fft.irfft2(np.fft.rfft2(white)/(radius+.0003)**.6,s=(size,size)).real
    field=(field-field.mean())/field.std()
    grain=np.clip(.5+field*.16,0,1)
    # Periodic, jittered Voronoi beds create fractured slabs and deep fissures.
    cells=8;jitter=rng.uniform(.18,.82,size=(cells,cells,2))
    yy,xx=np.mgrid[0:size,0:size].astype(np.float32);xx*=cells/size;yy*=cells/size
    ix=np.floor(xx).astype(int);iy=np.floor(yy).astype(int)
    nearest=np.full((size,size),np.inf);runner_up=nearest.copy();bed=np.zeros_like(nearest)
    colors=rng.uniform(.45,1,size=(cells,cells))
    for oy in [-1,0,1]:
        for ox in [-1,0,1]:
            cx=ix+ox;cy=iy+oy;s=jitter[cy%cells,cx%cells]
            d=(cx+s[:,:,0]-xx)**2+(cy+s[:,:,1]-yy)**2
            closer=d<nearest;runner_up=np.where(closer,nearest,np.minimum(runner_up,d));nearest=np.minimum(nearest,d)
            bed=np.where(closer,colors[cy%cells,cx%cells],bed)
    crack=np.exp(-((np.sqrt(runner_up)-np.sqrt(nearest))/.038)**2)
    height=bed*.022+grain*.006-crack*.022+rng.random((size,size))*.0007
    spacing=4/size
    dx=(np.roll(height,-1,1)-np.roll(height,1,1))/(2*spacing);dy=(np.roll(height,-1,0)-np.roll(height,1,0))/(2*spacing)
    normals=np.stack((-dx,-dy,np.ones_like(dx)),axis=-1);normals/=np.linalg.norm(normals,axis=-1,keepdims=True)
    terrain_images={}
    natural_source=out_dir/'Rock_Albedo.png'
    if natural_source.exists():
        shutil.copyfile(natural_source,out_dir/'TerrainTile_BaseColor.png')
        albedo=bpy.data.images.load(str(out_dir/'TerrainTile_BaseColor.png'));albedo.name='TerrainTile_BaseColor'
        terrain_images['BaseColor']=albedo;targets['TerrainTile_BaseColor']=albedo
        w,h=albedo.size;size=w
        raw=np.array(albedo.pixels[:],dtype=np.float32).reshape(h,w,4)
        luma=raw[:,:,:3]@np.array([.2126,.7152,.0722])
        height=(luma-luma.min())/max(float(np.ptp(luma)),.001)*.026
        dx=(np.roll(height,-1,1)-np.roll(height,1,1))/(8/w);dy=(np.roll(height,-1,0)-np.roll(height,1,0))/(8/h)
        normals=np.stack((-dx,-dy,np.ones_like(dx)),axis=-1);normals/=np.linalg.norm(normals,axis=-1,keepdims=True)
        grain=np.clip(luma,0,1)
    for channel in ['BaseColor','Normal','Roughness']:
        if channel in terrain_images:continue
        pixels=np.ones((size,size,4),dtype=np.float32)
        if channel=='BaseColor':pixels[:,:,:3]=np.array([.18,.15,.23])*(.38+grain[:,:,None]*.45+bed[:,:,None]*.4)*(1-crack[:,:,None]*.78)
        elif channel=='Normal':pixels[:,:,:3]=normals*.5+.5
        else:pixels[:,:,:3]=(.89+grain*.1)[:,:,None]
        img=bpy.data.images.new('TerrainTile_'+channel,width=size,height=size,alpha=False)
        if channel!='BaseColor':img.colorspace_settings.name='Non-Color'
        img.pixels.foreach_set(pixels.ravel());img.update();img.filepath_raw=str(out_dir/f'TerrainTile_{channel}.png');img.file_format='PNG';img.save()
        terrain_images[channel]=img;targets['TerrainTile_'+channel]=img
    tile_object(bpy.data.objects['Terrain_and_Floating_Rocks'],final_material('Terrain • tiled dry stone',terrain_images,.94),4)
    tile_object(bpy.data.objects['Arena_Columns_Props_Towers'],final_material('Architecture • detailed natural rock',terrain_images,.9),3)
    return targets
