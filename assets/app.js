'use strict';

// Let's initialize the app in an enclosure to make it more self-contained

(function(angular, $, _) {

  var app = angular.module('connect4', ['LocalStorageModule']);

  app.config(function(localStorageServiceProvider) {
    localStorageServiceProvider.setPrefix('c4');
  });

  app.controller('c4.main', function($scope, $timeout, $http, localStorageService) {

    // This stores the positions of the pucks in the rows
    $scope.matrix = {
      col0: [], col1: [], col2: [], col3: [], col4: [], col5: [], col6: []
    };

    // Game is active?
    $scope.game = true;

    // Are we watching a replay?
    $scope.replay = false;

    // Which turn is it currently?
    $scope.turn = 0;

    // The player who's move it currently is
    $scope.player = 1;

    // Sets a game ID based on an incrementing integer for replayability
    $scope.gameid = 0;

    // The last move of the player, stored for undo purposes
    $scope.lastCol = null;

    // This controls what modal windows to show
    $scope.modal = false;
    $scope.whichModal = null;

    // Begins our match
    $scope.beginGame = function() {
      $scope.game = true;
      $scope.replay = false;
      $scope.turn = 0;
      $scope.player = 1;
      $scope.gameid++;

      _.forEach($scope.matrix, function(col, n) {
        $scope.matrix[n] = [];
      });
    };

    // Initiates a move and tests to see if win conditions have been met
    $scope.makeMove = function(col) {
      if (!$scope.game && !$scope.replay) return;
      if (typeof $scope.matrix[col] !== 'object') return;
      if ($scope.matrix[col].length >= 6) return;

      $scope.lastCol = col;

      if (!$scope.replay) saveMove(col);

      $scope.matrix[col].push($scope.player);
      calculatePotentialWin(col);
    };

    // Undoes the last move
    $scope.undoMove = function() {
      if (!$scope.game) return;

      _.pullAt($scope.matrix[$scope.lastCol], $scope.matrix[$scope.lastCol].length - 1);

      switchPlayer();
      $scope.turn--;
      $scope.lastCol = null;

      unsaveMove();
    };

    // Show a replay of the last game for the benefit of the players
    $scope.replay = function() {
      $scope.toggleModal();
      $scope.game = false;
      $scope.replay = true;

      $scope.replayMoves = [];

      for (var i = 0; i < $scope.turn; i++) {
        var key = $scope.gameid + '.' + i;
        $scope.replayMoves.push(localStorageService.get(key));
      }

      $scope.turn = 0;

      $timeout(function() {
        var move = $scope.replayMoves[$scope.turn].slice(2);
        $scope.makeMove(move);
      }, 1000);
    };

    // Helper to test to see if it is possible to do an undo (ie. you only get one, the last one)
    $scope.undoPossible = function() {
      return !!$scope.lastCol;
    }

    // Completes the game and announces a winner
    $scope.finishGame = function(result) {
      $scope.game = false;

      switch(result) {
        case 'draw': registerResult('draw');
        case 'win': registerResult('win');
      }
    };

    // Opens/closes the modal window
    $scope.toggleModal = function() {
      $scope.whichModal = null;
      $scope.modal = !$scope.modal;
    };

    // A helper for modals telling it which modal content block to display
    $scope.currentModal = function(block) {
      return block === $scope.whichModal;
    };

    // Starts a new game + closes modal
    $scope.restart = function() {
      $scope.beginGame();
      $scope.toggleModal();
    };

    // Saves a move to local storage
    var saveMove = function(col) {
      if (!localStorageService.isSupported) return;
      var key = $scope.gameid + '.' + $scope.turn;
      localStorageService.set(key, $scope.player + '.' + col);
    };

    // In case of undo, we should remove the last move sent to local storage
    var unsaveMove = function() {
      if (!localStorageService.isSupported) return;
      var key = $scope.gameid + '.' + $scope.turn;
      localStorageService.remove(key);
    };

    // This is where we would send the result to the backend, if we had one...
    var registerResult = function(result) {
      $scope.whichModal = result;
      $scope.modal = true;
      sendToAPI();
    };

    // Send the results to our API
    var sendToAPI = function() {
      if (!localStorageService.isSupported) return;
      var payload = { gameId: $scope.gameid, moves: [] };

      for (var i = 0; i < $scope.turn; i++) {
        var key = $scope.gameid + '.' + i;
        var move = localStorageService.get(key).split('.');
        payload.moves.push({ turn: i, player: parseInt(move[0]), column: move[1] });
      }

      console.log('If we had a backend API, we would send data now:');
      console.log(payload);

      $http.post('/games', payload);
    };

    // Launches the initial modal and starts up some things
    var initialize = function() {
      $scope.modal = true;
      $scope.whichModal = 'begin';
    };

    // Runs through the potential win scenarios to see if we have a winner
    var calculatePotentialWin = function(col) {
      // There are a few win conditions we need to check for
      var victory = false;

      // First, let's check for a column
      if (checkColumn(col)) victory = true;

      // Now, let's check for a row
      if (checkRows(col)) victory = true;

      // And finally, diagonals
      if (checkDiagonals(col)) victory = true;

      if (victory) {
        $scope.finishGame('win');
      } else {
        $scope.lastCol = col;

        if (!calculatePotentialDraw()) {
          $scope.turn++;
          switchPlayer();
        } else {
          $scope.finishGame('draw');
        }
      }
    };

    // If we're running out of space to put pucks, time to kill the game
    var calculatePotentialDraw = function() {
      return ($scope.turn >= 41) ? true: false;
    };

    // Check for the vertical win condition
    var checkColumn = function(lastCol) {
      var column = $scope.matrix[lastCol];
      var count = 0;
      var win = false;

      _.forEach(column, function(puck) {
        if (puck === $scope.player) {
          count++;
          if (count >= 4) win = true;
        } else {
          count = 0;
        }
      });

      return win;
    };

    // Check for the horizontal win condition
    var checkRows = function(lastCol) {
      var row = $scope.matrix[lastCol].length - 1;
      var count = 0;
      var win = false;

      _.forEach($scope.matrix, function(col, n) {
        if (typeof col[row] !== 'undefined' && col[row] === $scope.player) {
          count++;
          if (count >= 4) win = true;
        } else {
          count = 0;
        }
      });

      return win;
    };

    // Check for diagonal win conditions
    var checkDiagonals = function(lastCol) {
      var row = $scope.matrix[lastCol].length - 1;
      var column = parseInt(lastCol.slice(-1));

      // Check for SW => NE diagonal
      // var deltaSW = checkVertex(row, column, 1);

      // Check for SE => NW diagonal
      // var deltaSE = checkVertex(row, column, -1);

      for (var x = -2; x <= 3; x++) {

      }

      //return (deltaSW || deltaSE) ? true : false;
    };

    // Abstract method for checking a diagonal vertex
    var checkVertex = function(row, column, operator) {
      var count = 0;
      var win = false;
      var delta = calculateDelta(row, column, operator);
      var deltaRow = 0;

      var max = (operator > 0) ? 0 : $scope.matrix.length - 1;
      var enumer = operator * -1;

      for (var i = delta; i === max; i + enumer) {
        if (typeof $scope.matrix['col' + i][deltaRow] !== 'undefined' && $scope.matrix['col' + i][deltaRow] === $scope.player) {
          count++;
          deltaRow++;
          if (count >= 4) win = true;
        } else {
          count = 0;
        }
      }
    };

    // We need to figure out what the delta is to calculate the diagonal
    var calculateDelta = function(row, col, operator) {
      var delta = col;
      while (row > 0) {
        row--;
        delta += operator;
      }
      return delta;
    };

    // Switches to a different player
    var switchPlayer = function() {
      $scope.player = ($scope.player === 1) ? 2 : 1;
    };

    initialize();

  });

})(angular, $, _);
