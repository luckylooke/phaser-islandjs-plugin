// http://sanojian.github.io/cellauto/

function CellAutoVoronoiCell(index) {
	this.index = index;
	this.delays = [];
}

CellAutoVoronoiCell.prototype.process = function(neighbors) {
	return;
};
CellAutoVoronoiCell.prototype.countSurroundingCellsWithValue = function(neighbors, value) {
	var surrounding = 0;
	for (var i = 0; i < neighbors.length; i++) {
		if (neighbors[i].ca && (neighbors[i].ca[value] || neighbors[i].ca[value] === 0)) {
			surrounding++;
		}
	}
	return surrounding;
};

CellAutoVoronoiCell.prototype.getSurroundingCellsAverageValue = function(neighbors, value) {
	var summed = 0.0;
	for (var i = 0; i < neighbors.length; i++) {
		if (neighbors[i].ca && neighbors[i].ca[value]) {
			summed += neighbors[i].ca[value];
		}
	}
	return summed / neighbors.length;//cnt;
};

CellAutoVoronoiCell.prototype.delay = function(numSteps, fn) {
	this.delays.push({ steps: numSteps, action: fn });
};

CellAutoVoronoiCell.prototype.reset = function(neighbors) {
	return;
};

function CAVWorld(voronoiCells, options) {

	this.options = options;
	this.voronoiCells = voronoiCells;
	this.cellsLength = voronoiCells.length;
	this.randomGenerator = Math.random;

	this.step = function() {
		for (var x=0; x<this.cellsLength; x++) {
			this.voronoiCells[x].ca.reset();
		}
		
		for (var x=0; x<this.cellsLength; x++) {
			var cell = this.voronoiCells[x];
			cell.ca.process(cell);

			// perform any delays
			for (var i=0; i<cell.ca.delays.length; i++) {
				if (!cell.ca.delays[i].steps--) {
					// perform action and remove delay
					cell.ca.delays[i].action(cell.ca);
					cell.ca.delays.splice(i, 1);
					i--;
				}
			}
		}
	};

	this.initialize = function(arrayTypeDist) {

		// sort the cell types by distribution
		arrayTypeDist.sort(function(a, b) {
			return a.distribution > b.distribution ? 1 : -1;
		});

		var totalDist = 0;
		// add all distributions together
		for (var i=0; i<arrayTypeDist.length; i++) {
			totalDist += arrayTypeDist[i].distribution;
			arrayTypeDist[i].distribution = totalDist;
		}

		for (var x=0; x<this.cellsLength; x++) {
			var random = this.randomGenerator() * 100;

			for (i=0; i<arrayTypeDist.length; i++) {
				if (random <= arrayTypeDist[i].distribution) {
					this.voronoiCells[x].ca = new this.cellTypes[arrayTypeDist[i].name](x);
					break;
				}
			}
		}
	
	};

	this.cellTypes = {};
	this.registerCellType = function(name, cellOptions, init) {
		this.cellTypes[name] = function(index) {
			CellAutoVoronoiCell.call(this, index);

			if (init) {
				init.call(this);
			}

			if (cellOptions) {
				for (var key in cellOptions) {
					if (typeof cellOptions[key] !== 'function') {
						// properties get instance
						if (typeof cellOptions[key] === 'object') {
							// objects must be cloned
							this[key] = JSON.parse(JSON.stringify(cellOptions[key]));
						}
						else {
							// primitive
							this[key] = cellOptions[key];
						}
					}
				}
			}
		};
		this.cellTypes[name].prototype = Object.create(CellAutoVoronoiCell.prototype);
		this.cellTypes[name].prototype.constructor = this.cellTypes[name];
		this.cellTypes[name].prototype.cellType = name;

		if (cellOptions) {
			for (var key in cellOptions) {
				if (typeof cellOptions[key] === 'function') {
					// functions get prototype
					this.cellTypes[name].prototype[key] = cellOptions[key];
				}
			}
		}
	};

	// apply options
	if (options) {
		for (var key in options) {
			this[key] = options[key];
		}
	}

}

(function() {
  var CellAutoVoronoi = {
    World: CAVWorld,
    Cell: CellAutoVoronoiCell
  };

  if (typeof define === 'function' && define.amd) {
    define('CellAutoVoronoi', function () {
      return CellAutoVoronoi;
    });
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = CellAutoVoronoi;
  } else {
    window.CellAutoVoronoi = CellAutoVoronoi;
  }
})();


// TODO: try cellular auto demo on voronoi island