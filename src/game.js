
/* global Phaser CAVWorld */
window.onload = function () {
  function preload(){
    this.load.image('cave', 'src/assets/cave.png');
  }
  function create(){
    var island = this.game.plugins.add(Phaser.Plugin.Island, {
      // custom settings
        perlinWidth: this.game.width/2,
        perlinHeight: this.game.height/2,
        nbSites: 3000,
    });
    // island.DISPLAY_COLORS.OCEAN = '#4444ff';
    island.renderNow();
    
    function example_caves() {
  
    	var cells = island.diagram.cells,
    	  world = new CAVWorld(cells);
    
    	world.registerCellType('wall', {
    		process: function (cellVoronoi) {
    		  var neighbors = cellVoronoi.neighborsCache || island.getNeighbors(cellVoronoi.site.voronoiId),
    		    surrounding  = this.countSurroundingCellsWithValue(neighbors, 'wasOpen');
   
    			this.open = (this.wasOpen && surrounding >= 3) || surrounding >= 5;
    		},
    		reset: function () {
    			this.wasOpen = this.open;
    		}
    	}, function () {
    		//init
    		this.open = Math.random() > 0.40;
    	});
    
    	world.initialize([
    		{ name: 'wall', distribution: 100 }
    	]);
    
    	return world;
    }
    
    var test = example_caves();
    
    var testBtnFn = function() {
      test.step();
      console.log('testBtnFn');
      for (var i = 0; i < test.voronoiCells.length; i++) {
        var cell = test.voronoiCells[i],
          ctx = island.debugLayer.ctx,
          borders = cell.bordersCache || island.getBorders(cell.site.voronoiId),
          bLength = borders.length, y;
          
        ctx.fillStyle = cell.ca.open ? '#fff' : '#000';
        ctx.beginPath();
        ctx.moveTo(borders[0].x,borders[0].y);
        for (y = 1; y < bLength; y++) {
          ctx.lineTo(borders[y].x,borders[y].y);
        }
        ctx.closePath();
        ctx.fill();
      }
      island.debugLayer.dirty = true;
    };
    
    var button = this.game.add.button(95, 400, 'cave', testBtnFn, this, 2, 1, 0);
      button.fixedToCamera = true;
      button.cameraOffset.setTo(10, 30);
    }
    
  new Phaser.Game(window.innerWidth, window.innerHeight, Phaser.AUTO, 'phaser-game', {create: create, preload:preload});
  
  function create2(){
    var island = this.game.plugins.add(Phaser.Plugin.Island, {
          nbSites: 100,
          perlinWidth: this.game.width/2,
          perlinHeight: this.game.height/2,
          // seed: 168165168,
          allowDebug: true
      });
      island.renderNow();
      this.game.input.onDown.add(function click(pointer) {
        island.renderSite(island.cellIdFromPoint(pointer.x, pointer.y));
      });
  }
  
  new Phaser.Game(window.innerWidth, window.innerHeight, Phaser.AUTO, 'phaser-game-debugger', {create: create2});
};
 