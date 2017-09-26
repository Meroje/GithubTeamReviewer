/* global _ */

'use strict';

angular.module('gtrApp')
  .controller('MainCtrl', function ($scope, $location, $interval, PullFetcher, authManager, config, team) {
    var oauthEnabled    = !angular.isUndefined(config.githubOAuth);
    $scope.oauthEnabled = oauthEnabled;
    if (oauthEnabled) {
      authManager.authenticateTeams();
      $scope.loginUrls       = authManager.getLoginUrls();
      $scope.logoutClientIds = authManager.getLogoutClientIds();
    }

    $scope.pulls = PullFetcher.pulls;
    $scope.teams = config.teams;
    $scope.team  = team;

    if (typeof(config.teams[team].descendingOrder) !== 'undefined') {
      $scope.descendingOrder = config.teams[team].descendingOrder;
    } else {
      $scope.descendingOrder = true;
    }

    if (typeof(config.teams[team].labels) !== 'undefined') {
      $scope.labels = config.teams[team].labels;
    } else {
      $scope.labels = false;
    }

    if (typeof(config.teams[team].milestones) !== 'undefined') {
      $scope.milestones = config.teams[team].milestones;
    } else {
      $scope.milestones = false;
    }

    $scope.toArray = function (items) {
      var array = [];
      angular.forEach(items, function(item) {
        array.push(item);
      });

      return array;
    };

    $scope.logout = function(clientId) {
      authManager.logout(clientId);
      $scope.loginUrls       = authManager.getLoginUrls();
      $scope.logoutClientIds = authManager.getLogoutClientIds();
    };

    $scope.$watch('team', function (team) {
      $location.path(team);
    });

    $scope.$on('$destroy', function () {
      $interval.cancel(polling);
    });

    var polling = $interval(function () {
      PullFetcher.refreshPulls();
    }, config.refreshInterval * 1000);

    PullFetcher.setTeam($scope.teams[team]);
    PullFetcher.refreshPulls();
  });
