/**
* An island generation plugin made from github.com/lebesnec/island.js
* Maintained by github.com/luckylooke
*/

/* global Voronoi perlinNoise Phaser */
Phaser.Plugin.Island = function (game, parent) {
	Phaser.Plugin.call(this, game, parent);
	
	this.game = game;
};

//	Extends the Phaser.Plugin template, setting up values we need
Phaser.Plugin.Island.prototype = Object.create(Phaser.Plugin.prototype);
Phaser.Plugin.Island.prototype.constructor = Phaser.Plugin.Island;

Phaser.Plugin.Island.prototype.init = function (userConfig) {

    // console.log('userConfig', userConfig);
    
    var game = this.game;

	this.DISPLAY_COLORS = {
        OCEAN: '#82caff',
        BEACH: '#ffe98d',
        CLIFF: '#ff0000',
        LAKE: '#2f9ceb',
        RIVER: '#369eea',
        SOURCE: '#00f',
        MARSH: '#2ac6d3',
        ICE: '#b3deff',
        ROCK: '#535353',
        LAVA: '#e22222',
        SNOW: '#f8f8f8',
        TUNDRA: '#ddddbb',
        BARE: '#bbbbbb',
        SCORCHED: '#999999',
        TAIGA: '#ccd4bb',
        SHRUBLAND: '#c4ccbb',
        TEMPERATE_DESERT: '#e4e8ca',
        TEMPERATE_RAIN_FOREST: '#a4c4a8',
        TEMPERATE_DECIDUOUS_FOREST: '#b4c9a9',
        GRASSLAND: '#c4d4aa',
        TROPICAL_RAIN_FOREST: '#9cbba9',
        TROPICAL_SEASONAL_FOREST: '#a9cca4',
        SUBTROPICAL_DESERT: '#e9ddc7'
    };
	this.config = {
        width: game.width,
        height: game.height,
        perlinWidth: (game.width / 3),
        perlinHeight: (game.height / 3),
        allowDebug: false, // if set to true, you can clic on the map to enter "debug" mode. Warning : debug mode is slow to initialize, set to false for faster rendering.
        nbSites: (game.width * game.height) / 100, // nb of voronoi cell
        sitesDistribution: 'hexagon', // distribution of the site : random, square or hexagon
        sitesRandomisation: 80, // will move each site in a random way (in %), for the square or hexagon distribution to look more random
        nbGraphRelaxation: 0, // nb of time we apply the relaxation algo to the voronoi graph (slow !), for the random distribution to look less random
        cliffsThreshold: 0.15,
        lakesThreshold: 0.005, // lake elevation will increase by this value (* the river size) when a new river end inside
        maxRiversSize: 4,
        shading: 0.35,
        shadeOcean: true,
        seed: Math.random()
    };
    this.config.nbRivers = this.config.nbSites / 200,
    this.debug = false; // true if "debug" mode is activated
    this.voronoi = new Voronoi();
    this.diagram = null;
    this.sites = [];
    
    console.log(this.voronoi);
    
    // Apply userConfig
    for (var prop in userConfig) {
      if (userConfig.hasOwnProperty(prop)) {
        this.config[prop] = userConfig[prop];
      }
    }
    
    // console.log('seed', this.config.seed);
    
    this.cellsLayer = new Phaser.BitmapData(this.game, 'cells', this.config.width, this.config.height);
    this.riversLayer = new Phaser.BitmapData(this.game, 'rivers', this.config.width, this.config.height);
    this.debugLayer = new Phaser.BitmapData(this.game, 'debug', this.config.width, this.config.height);
    
    this.perlinCanvas = document.getElementById('perlin');
    this.perlinCanvas.width = this.config.perlinWidth;
    this.perlinCanvas.height = this.config.perlinHeight;
    this.perlin = perlinNoise(this.perlinCanvas, 64, 64, this.config.seed);
    this.randomSites();
    
    this.assignOceanCoastAndLand();
    this.assignRivers();
    this.assignMoisture();
    this.assignBiomes();
    this.treemap == null;

};

Phaser.Plugin.Island.prototype.randomSites = function (n) {
    var sites = [];
    var rnd = new Phaser.RandomDataGenerator(this.config.seed);

    // create vertices
    if (this.config.sitesDistribution == 'random') {
        for (var i = 0; i < this.config.nbSites; i++) {
            sites.push({
                x: Math.round(rnd.frac() * this.config.width),
                y: Math.round(rnd.frac() * this.config.height)
            });
        }
    } else {
        var delta = Math.sqrt(this.config.width * this.config.height / this.config.nbSites);
        var rand = this.config.sitesRandomisation * delta / 100;
        var x = 0;
        var y = 0;
        for (var i = 0; i < this.config.nbSites; i++) {
            sites.push({
                x: Math.max(Math.min(Math.round(x * delta + (rnd.frac() * rand)), this.config.width), 0),
                y: Math.max(Math.min(Math.round(y * delta + (rnd.frac() * rand)), this.config.height), 0)
            });
            x = x + 1;
            if (x * delta > this.config.width) {
                x = (y % 2 == 1 || this.config.sitesDistribution == 'square' ? 0 : 0.5);
                y = y + 1;
            }
        }
    }
    this.compute(sites);
    for (var i = 0; i < this.config.nbGraphRelaxation; i++) {
        this.relaxSites();
    }
};

Phaser.Plugin.Island.prototype.compute = function (sites) {
    this.sites = sites;
    this.voronoi.recycle(this.diagram);
    this.bbox = {xl: 0, xr: this.config.width, yt: 0, yb: this.config.height};
    this.diagram = this.voronoi.compute(sites, this.bbox);
};

Phaser.Plugin.Island.prototype.relaxSites = function () {
    var rnd = new Phaser.RandomDataGenerator(this.config.seed);
    if (!this.diagram) {
        return;
    }
    var cells = this.diagram.cells,
        iCell = cells.length,
        cell,
        site, sites = [],
        rn, dist;
    var p = 1 / iCell * 0.1;
    while (iCell--) {
        cell = cells[iCell];
        rn = rnd.frac();
        // probability of apoptosis
        if (rn < p) {
            continue;
        }
        site = this.cellCentroid(cell);
        dist = this.distance(site, cell.site);
        // don't relax too fast
        if (dist > 2) {
            site.x = (site.x + cell.site.x) / 2;
            site.y = (site.y + cell.site.y) / 2;
        }
        // probability of mytosis
        if (rn > (1 - p)) {
            dist /= 2;
            sites.push({
                x: site.x + (site.x - cell.site.x) / dist,
                y: site.y + (site.y - cell.site.y) / dist
            });
        }
        sites.push(site);
    }
    this.compute(sites);
};

Phaser.Plugin.Island.prototype.cellArea = function (cell) {
    var area = 0,
        halfedges = cell.halfedges,
        iHalfedge = halfedges.length,
        halfedge,
        p1, p2;
    while (iHalfedge--) {
        halfedge = halfedges[iHalfedge];
        p1 = halfedge.getStartpoint();
        p2 = halfedge.getEndpoint();
        area += p1.x * p2.y;
        area -= p1.y * p2.x;
    }
    area /= 2;
    return area;
};

Phaser.Plugin.Island.prototype.cellCentroid = function (cell) {
    var x = 0,
        y = 0,
        halfedges = cell.halfedges,
        iHalfedge = halfedges.length,
        halfedge,
        v, p1, p2;
    while (iHalfedge--) {
        halfedge = halfedges[iHalfedge];
        p1 = halfedge.getStartpoint();
        p2 = halfedge.getEndpoint();
        v = p1.x * p2.y - p2.x * p1.y;
        x += (p1.x + p2.x) * v;
        y += (p1.y + p2.y) * v;
    }
    v = this.cellArea(cell) * 6;
    return {
        x: x / v,
        y: y / v
    };
};

Phaser.Plugin.Island.prototype.assignOceanCoastAndLand = function() {
    // water
    var queue = new Array();
    for (var i = 0; i < this.diagram.cells.length; i++) {
        var cell = this.diagram.cells[i];
        cell.elevation = this.getElevation(cell.site);
        cell.water = (cell.elevation <= 0);
        for (var j = 0; j < cell.halfedges.length; j++) {
            var hedge = cell.halfedges[j];
            // border 
            if (hedge.edge.rSite == null) {
                cell.border = true;
                cell.ocean = true;
                cell.water = true;
                if (cell.elevation > 0) {
                    cell.elevation = 0;
                }
                queue.push(cell);
            }
        }
    }
    
    // ocean
    while (queue.length > 0) {
        cell = queue.shift();
        var neighbors = cell.getNeighborIds();
        for (var i = 0; i < neighbors.length; i++) {
            var nId = neighbors[i];
            var neighbor = this.diagram.cells[nId];
            if (neighbor.water && !neighbor.ocean) {
                neighbor.ocean = true;
                queue.push(neighbor);
            }
        } 
    }
    
    // coast
    for (var i = 0; i < this.diagram.cells.length; i++) {
        cell = this.diagram.cells[i];
        var numOcean = 0;
        neighbors = cell.getNeighborIds();
        for (var j = 0; j < neighbors.length; j++) {
            nId = neighbors[j];
            neighbor = this.diagram.cells[nId];
            if (neighbor.ocean) {
               numOcean++;
            }
        } 
        cell.coast = (numOcean > 0) && (!cell.water);
        cell.beach = (cell.coast && cell.elevation < this.config.cliffsThreshold);
    }
    
    // cliff
    for (var i = 0; i < this.diagram.edges.length; i++) {
        var edge = this.diagram.edges[i];
        if (edge.lSite != null && edge.rSite != null) {
            var lCell = this.diagram.cells[edge.lSite.voronoiId];
            var rCell = this.diagram.cells[edge.rSite.voronoiId];      
            edge.cliff = (!(lCell.water && rCell.water) && (Math.abs(this.getRealElevation(lCell) - this.getRealElevation(rCell)) >= this.config.cliffsThreshold));
        }            
    }
};

Phaser.Plugin.Island.prototype.assignRivers = function() {
    var rnd = new Phaser.RandomDataGenerator(this.config.seed);
    for (var i = 0; i < this.config.nbRivers;) {
        var cell = this.diagram.cells[rnd.integerInRange(0, this.diagram.cells.length - 1)];
        if (!cell.coast) {
            if (this.setAsRiver(cell, 1)) {
                cell.source = true;
                i++;
            }
        }
    }
};

Phaser.Plugin.Island.prototype.setAsRiver = function(cell, size) {
    if (!cell.water && !cell.river) {
        cell.river = true;
        cell.riverSize = size;
        var lowerCell = null;
        var neighbors = cell.getNeighborIds();
        // we choose the lowest neighbour cell :
        for (var j = 0; j < neighbors.length; j++) {
            var nId = neighbors[j];
            var neighbor = this.diagram.cells[nId];
            if (lowerCell == null || neighbor.elevation < lowerCell.elevation) {
                lowerCell = neighbor;
            }
        } 
        if (lowerCell.elevation < cell.elevation) {
            // we continue the river to the next lowest cell :
            this.setAsRiver(lowerCell, size);
            cell.nextRiver = lowerCell; 
        } else {
            // we are in a hole, so we create a lake :
            cell.water = true;
            this.fillLake(cell);
        }
    } else if (cell.water && !cell.ocean) {
        // we ended in a lake, the water level rise :
        cell.lakeElevation = this.getRealElevation(cell) + (this.config.lakesThreshold * size);
        this.fillLake(cell);
    } else if (cell.river) {
        // we ended in another river, the river size increase :
        cell.riverSize ++;
        var nextRiver = cell.nextRiver;
        while (nextRiver) {
            nextRiver.riverSize ++;
            nextRiver = nextRiver.nextRiver;
        }
    }
    
    return cell.river;
};

Phaser.Plugin.Island.prototype.fillLake = function(cell) {
    // if the lake has an exit river he can not longer be filled
    if (cell.exitRiver == null) { 
        var exitRiver = null;
        var exitSource = null;
        var lake = new Array();
        var queue = new Array();
        queue.push(cell);
        
        while (queue.length > 0) {
            var c = queue.shift();
            lake.push(c);
            var neighbors = c.getNeighborIds();
            for (var i = 0; i < neighbors.length; i++) {
                var nId = neighbors[i];
                var neighbor = this.diagram.cells[nId];
                
                if (neighbor.water && !neighbor.ocean) { // water cell from the same lake
                    if (neighbor.lakeElevation == null || neighbor.lakeElevation < c.lakeElevation) {
                        neighbor.lakeElevation = c.lakeElevation;
                        queue.push(neighbor);
                    }
                } else { // ground cell adjacent to the lake
                    if (c.elevation < neighbor.elevation) {
                        if (neighbor.elevation - c.lakeElevation < 0) {
                            // we fill the ground with water
                            neighbor.water = true;
                            neighbor.lakeElevation = c.lakeElevation;
                            queue.push(neighbor);
                        }
                    } else {
                        //neighbor.source = true;
                        // we found an new exit for the lake :
                        if (exitRiver == null || exitRiver.elevation > neighbor.elevation) {
                            exitSource = c;
                            exitRiver = neighbor;
                        } 
                    }
                }
            } 
        }
        
        if (exitRiver != null) {
            // we start the exit river :
            exitSource.river = true;
            exitSource.nextRiver = exitRiver;
            this.setAsRiver(exitRiver, 2);
            // we mark all the lake as having an exit river :
            while (lake.length > 0) {
                c = lake.shift();
                c.exitRiver = exitRiver;
            }
        }
    }
};

// Calculate moisture. Freshwater sources spread moisture: rivers and lakes (not ocean). 
Phaser.Plugin.Island.prototype.assignMoisture = function() {
    var queue = new Array();
    // lake and river 
    for (var i = 0; i < this.diagram.cells.length; i++) {
        var cell = this.diagram.cells[i];
        if ((cell.water || cell.river) && !cell.ocean) {
            cell.moisture = (cell.water ? 1 : 0.9);
            if (!cell.ocean) {
                queue.push(cell);
            }
        }
    }
    
    while (queue.length > 0) {
        cell = queue.shift();
        var neighbors = cell.getNeighborIds();
        for (var i = 0; i < neighbors.length; i++) {
            var nId = neighbors[i];
            var neighbor = this.diagram.cells[nId];
            var newMoisture = cell.moisture * 0.9;
            if (neighbor.moisture == null || newMoisture > neighbor.moisture) {
                neighbor.moisture = newMoisture;
                queue.push(neighbor);
            }
        } 
    }
    
    // ocean
    for (var i = 0; i < this.diagram.cells.length; i++) {
        cell = this.diagram.cells[i];
        if (cell.ocean) {
            cell.moisture = 1;
        }
    }
};

Phaser.Plugin.Island.prototype.assignBiomes = function() {
    for (var i = 0; i < this.diagram.cells.length; i++) {
        var cell = this.diagram.cells[i];
        cell.biome = this.getBiome(cell);
    }
};

Phaser.Plugin.Island.prototype.getBiome = function (cell) {
    if (cell.ocean) {
        return 'OCEAN';
    } else if (cell.water) {
        if (this.getRealElevation(cell) < 0.05) return 'MARSH';
        if (this.getRealElevation(cell) > 0.4) return 'ICE';
        return 'LAKE';
    } else if (cell.beach) {
        return 'BEACH';
    } else if (cell.elevation > 0.4) {
        if (cell.moisture > 0.50) return 'SNOW';
        else if (cell.moisture > 0.33) return 'TUNDRA';
        else if (cell.moisture > 0.16) return 'BARE';
        else return 'SCORCHED';
    } else if (cell.elevation > 0.3) {
        if (cell.moisture > 0.66) return 'TAIGA';
        else if (cell.moisture > 0.33) return 'SHRUBLAND';
        else return 'TEMPERATE_DESERT';
    } else if (cell.elevation > 0.15) {
        if (cell.moisture > 0.83) return 'TEMPERATE_RAIN_FOREST';
        else if (cell.moisture > 0.50) return 'TEMPERATE_DECIDUOUS_FOREST';
        else if (cell.moisture > 0.16) return 'GRASSLAND';
        else return 'TEMPERATE_DESERT';
    } else {
        if (cell.moisture > 0.66) return 'TROPICAL_RAIN_FOREST';
        else if (cell.moisture > 0.33) return 'TROPICAL_SEASONAL_FOREST';
        else if (cell.moisture > 0.16) return 'GRASSLAND';
        else return 'SUBTROPICAL_DESERT';
    }
};

// The Perlin-based island combines perlin noise with the radius
Phaser.Plugin.Island.prototype.getElevation = function (point) {
    var x = 2 * (point.x / this.config.width - 0.5);
    var y = 2 * (point.y / this.config.height - 0.5);
    var distance = Math.sqrt(x * x + y * y);
    var c = this.getPerlinValue(point); 

    return c - distance;
    //return c - (0.3 + 0.3 * distance * distance);
};

Phaser.Plugin.Island.prototype.getPerlinValue = function(point) {
    var x = ((point.x / this.config.width) * this.perlin.width) | 0;
    var y = ((point.y / this.config.height) * this.perlin.height) | 0;        
    var pos = (x + y * this.perlin.width) * 4;
    var data = this.perlin.data;
    var val = data[pos + 0] << 16 | data[pos + 1] << 8 | data[pos + 2]; // rgb to hex
    
    return (val & 0xff) / 255.0;
};

Phaser.Plugin.Island.prototype.getRealElevation = function(cell) {
    if (cell.water && cell.lakeElevation != null) {
        return cell.lakeElevation;
    } else if (cell.water && cell.elevation < 0) {
        return 0;
    } else {
        return cell.elevation;
    }
};

Phaser.Plugin.Island.prototype.renderNow = function () {
    if (!this.diagram) {
        return;
    }
    
    this.renderCells();
    this.renderRivers();
    
    if (this.config.allowDebug) {
        this.renderEdges();
        this.renderSites();
        this.debugLayer.sprite = this.game.add.sprite(0, 0, this.debugLayer);
    }
 
};

Phaser.Plugin.Island.prototype.renderCells = function() {
    var ctx = this.cellsLayer.ctx;
    
    for (var cellid in this.diagram.cells) {
        var cell = this.diagram.cells[cellid];
        var color = this.pgetCellColor(cell);
        
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        var start =  cell.halfedges[0].getStartpoint();
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        for (var iHalfedge = 0; iHalfedge < cell.halfedges.length; iHalfedge++) {
            var halfEdge = cell.halfedges[iHalfedge];
            var end = halfEdge.getEndpoint();
            ctx.lineTo(end.x, end.y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
    }
    this.cellsLayer.sprite = this.game.add.sprite(0, 0, this.cellsLayer);
};

Phaser.Plugin.Island.prototype.renderRivers = function() {
    // TODO: river made from arcs
    var ctx = this.riversLayer.ctx,
    riverColor = Phaser.Color.hexToColor(this.DISPLAY_COLORS.RIVER);
    if (this.config.allowDebug) {
        var ctx2 = this.debugLayer.ctx,
        sourceColor = this.DISPLAY_COLORS.SOURCE;
    }
    for (var cellid in this.diagram.cells) {
        var cell = this.diagram.cells[cellid];
        if (cell.nextRiver) {
            ctx.beginPath();
            ctx.lineWidth = Math.min(cell.riverSize, this.config.maxRiversSize);
            var shade = parseInt(this.getShade(cell)*120, 10);
            ctx.strokeStyle = Phaser.Color.RGBtoString(riverColor.r-shade, riverColor.g-shade, riverColor.b-shade, riverColor.a, '#');
            if (cell.water) {
                ctx.moveTo(cell.site.x + (cell.nextRiver.site.x - cell.site.x) / 2, cell.site.y + (cell.nextRiver.site.y - cell.site.y) / 2);
            } else {
                ctx.moveTo(cell.site.x, cell.site.y);
            }
            if (cell.nextRiver && !cell.nextRiver.water) {
                ctx.lineTo(cell.nextRiver.site.x, cell.nextRiver.site.y);
            } else {
                ctx.lineTo(cell.site.x + (cell.nextRiver.site.x - cell.site.x) / 2, cell.site.y + (cell.nextRiver.site.y - cell.site.y) / 2);
            }
            ctx.stroke();
        }
        
        // source :
        if (this.config.allowDebug && cell.source) {
            ctx2.beginPath();
            ctx2.fillStyle = sourceColor;
            ctx2.arc(cell.site.x,cell.site.y,3,0,2*Math.PI);
            ctx2.fill();
        }
    }
    this.riversLayer.sprite = this.game.add.sprite(0, 0, this.riversLayer);
};

Phaser.Plugin.Island.prototype.renderEdges = function() {
    var ctx = this.debugLayer.ctx,
        edges = this.diagram.edges,
        iEdge = edges.length,
        edge, v;
    while (iEdge--) {
        edge = edges[iEdge];
        ctx.beginPath();

        if (edge.cliff) {
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.strokeStyle = this.DISPLAY_COLORS.CLIFF;
        } else {
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#000';
        }
        v = edge.va;
        ctx.moveTo(v.x, v.y);
        v = edge.vb;
        ctx.lineTo(v.x, v.y);
        ctx.stroke();
    }
};

Phaser.Plugin.Island.prototype.renderSites = function() {
    // sites :
    var sites = this.sites,
        iSite = sites.length,
        ctx = this.debugLayer.ctx,
        site;
        
    ctx.fillStyle = '#0f0';
    while (iSite--) {
        site = sites[iSite];
        ctx.beginPath();
        ctx.arc(site.x,site.y,1,0,2*Math.PI);
        ctx.fill();
    }       

    var iCells = this.diagram.cells.length;
    
    ctx.font="8px";
    ctx.fillStyle = '#f00';
    // values :
    for (var i = 0; i < iCells; i++) {
        var cell = this.diagram.cells[i];
        ctx.fillText(Math.ceil(this.getRealElevation(cell) * 100),cell.site.x,cell.site.y);
    }
};

Phaser.Plugin.Island.prototype.renderSite = function(index) {
    var cell = this.diagram.cells[index],
        he = cell.halfedges,
        ctx = this.debugLayer.ctx,
        point;
      
      ctx.font="8px";
      ctx.fillStyle = '#ff0';
      
      ctx.beginPath();
      ctx.arc(cell.site.x,cell.site.y,2,0,2*Math.PI);
      ctx.fill();
      
     
      
      for (var i = 0; i < he.length; i++) {
        ctx.fillStyle = '#ff0';
        point = he[i].edge.lSite;
        ctx.fillText('L'+i,point.x-8,point.y-8);
        point = he[i].edge.rSite;
        if(point){
            ctx.fillText('R'+i,point.x+8,point.y+8);
        }
        
        ctx.fillStyle = '#0f0';
        point = he[i].getEndpoint();
        ctx.beginPath();
        ctx.arc(point.x,point.y,1,0,2*Math.PI);
        ctx.fill();
        ctx.fillText('E'+i,point.x-8,point.y-8);
        point = he[i].getStartpoint();
        ctx.beginPath();
        ctx.arc(point.x,point.y,1,0,2*Math.PI);
        ctx.fill();
        ctx.fillText('S'+i,point.x+8,point.y+8);
      }
};

Phaser.Plugin.Island.prototype.getCellColor = function(cell) {
    var c = this.DISPLAY_COLORS[cell.biome].clone();
    c.brightness = c.brightness - this.getShade(cell);
    
    return c;
};

Phaser.Plugin.Island.prototype.pgetCellColor = function(cell) {
    
    // TODO: better color shading via: http://stackoverflow.com/a/22825467/861615
    
    var c = Phaser.Color.hexToColor(this.DISPLAY_COLORS[cell.biome]),
    shade = parseInt(this.getShade(cell)*120, 10);
    c = Phaser.Color.RGBtoString(c.r-shade, c.g-shade, c.b-shade, c.a, '#');
    return c;
};

Phaser.Plugin.Island.prototype.getShade = function(cell) {
    if (this.config.shading == 0) {
        return 0;
        
    } else if (cell.ocean) {
        return (this.config.shadeOcean ? - cell.elevation : 0);
        
    } else if (cell.water) {
        return 0;
        
    } else {
        var lowerCell = null;
        var upperCell = null;
        var neighbors = cell.getNeighborIds();
        for (var j = 0; j < neighbors.length; j++) {
            var nId = neighbors[j];
            var neighbor = this.diagram.cells[nId];
            if (lowerCell == null || neighbor.elevation < lowerCell.elevation) {
                lowerCell = neighbor;
            }
            if (upperCell == null || neighbor.elevation > upperCell.elevation) {
                upperCell = neighbor;
            }
        }
        
        var angleRadian = Math.atan2(upperCell.site.x - lowerCell.site.x, upperCell.site.y - lowerCell.site.y);
        var angleDegree = angleRadian * (180 / Math.PI);
        var diffElevation = (this.getRealElevation(upperCell) - this.getRealElevation(lowerCell));
        
        if (diffElevation + this.config.shading < 1) {
            diffElevation = diffElevation + this.config.shading;
        }
        
        return ((Math.abs(angleDegree) / 180) * diffElevation);
    }
};
    
Phaser.Plugin.Island.prototype.toggleDebug = function() {
    // TODO: Finish this toggling
    this.debug = !this.debug;
    // this.debugLayer.visible = this.debug;
};

Phaser.Plugin.Island.prototype.distance = function(a, b) {
    var dx = a.x - b.x,
        dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
};

Phaser.Plugin.Island.prototype.cellIdFromPoint = function(x, y) {
	// We build the treemap on-demand
	if (!this.treemap) {
		this.treemap = this.buildTreemap();
	}
	// Get the Voronoi cells from the tree map given x,y
	var items = this.treemap.retrieve({body:{x:x,y:y,right:x+1,bottom:y+1}}),
		iItem = items.length,
		cells = this.diagram.cells,
		cell, cellid;
	while (iItem--) {
		cellid = items[iItem].cellid;
		cell = cells[cellid];
		if (cell.pointIntersection(x,y) > 0) {
			return cellid;
		}
	}
	return undefined;
};

Phaser.Plugin.Island.prototype.buildTreemap = function() {
	var treemap = new Phaser.QuadTree(
    		this.bbox.xl,
    		this.bbox.yt,
    		this.bbox.xr-this.bbox.xl,
    		this.bbox.yb-this.bbox.yt
		),
	    cells = this.diagram.cells,
		iCell = cells.length,
		cbox;
	while (iCell--) {
	    // https://github.com/photonstorm/phaser/issues/1854
		cbox = cells[iCell].getBbox();
		cbox.right = parseInt(cbox.x + cbox.width);
		cbox.bottom = parseInt(cbox.y + cbox.height);
		cbox.x = parseInt(cbox.x);
		cbox.y = parseInt(cbox.y);
		cbox.cellid = iCell;
		treemap.insert(cbox);
	}
	return treemap;
};
