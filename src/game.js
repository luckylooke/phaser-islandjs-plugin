
/* global Phaser */
window.onload = function () {
  function create(){
      var island = this.game.plugins.add(Phaser.Plugin.Island, {
        // custom settings
          perlinWidth: this.game.width/2,
          perlinHeight: this.game.height/2
      });
      // island.DISPLAY_COLORS.OCEAN = '#4444ff';
      island.renderNow();
  }
  
  var game = new Phaser.Game(window.innerWidth, window.innerHeight, Phaser.AUTO, 'phaser-game', {create: create});
  
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
  
  var game = new Phaser.Game(window.innerWidth, window.innerHeight, Phaser.AUTO, 'phaser-game-debugger', {create: create2});
  
  
};
 