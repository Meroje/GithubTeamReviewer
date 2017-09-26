'use strict';

angular.module('gtrApp')
  .provider('PullFetcher', function () {
    var baseUrl = 'https://api.github.com';

    var PULLS_QUERY = [
      'query repositories($query: String!, $count: Int = 6, $reviewStates: [PullRequestReviewState!] = [APPROVED, CHANGES_REQUESTED], $pullRequestStates: [PullRequestState!] = [OPEN]) {',
      '  search(type: USER, first: $count, query: $query) {',
      '    edges {',
      '      node {',
      '        ...repositoryOwnerFields',
      '      }',
      '    }',
      '  }',
      '}',
      '',
      'fragment repositoryOwnerFields on RepositoryOwner {',
      '  login',
      '  repositories(first: 100) {',
      '    edges {',
      '      node {',
      '        ...repositoryFields',
      '      }',
      '    }',
      '  }',
      '}',
      '',
      'fragment repositoryFields on Repository {',
      '  pullRequests(first: 100, states: $pullRequestStates) {',
      '    edges {',
      '      node {',
      '        ...pullRequestFields',
      '      }',
      '    }',
      '  }',
      '}',
      '',
      'fragment pullRequestFields on PullRequest {',
      '  id',
      '  title',
      '  number',
      '  url',
      '  created_at: createdAt',
      '  updated_at: updatedAt',
      '  repo: repository {',
      '    url',
      '    full_name: nameWithOwner',
      '  }',
      '  headRef {',
      '    target {',
      '      ... on Commit {',
      '        status {',
      '          state',
      '        }',
      '      }',
      '    }',
      '  }',
      '  user: author {',
      '    login',
      '    avatar_url: avatarUrl',
      '  }',
      '  reviews(last: 50, states: $reviewStates) {',
      '    edges {',
      '      node {',
      '        state',
      '      }',
      '    }',
      '  }',
      '  labels(first: 5) {',
      '    edges {',
      '      node {',
      '        color',
      '        name',
      '      }',
      '    }',
      '  }',
      '}'
    ].join('\n');

    this.$get = ['$http', '$q', function ($http, $q) {

      var currentTeam,
        currentApiUrl,
        authHeader;

      var pullFetcher = {
        pulls: {},
        setTeam: function (team) {
          currentTeam   = team;
          currentApiUrl = (team.apiUrl || baseUrl) + '/graphql';
          authHeader    = {};

          if (team.token) {
            authHeader = {'Authorization': 'Bearer ' + team.token};
          }

          // Empty pulls object
          for (var id in this.pulls) {
            if (this.pulls.hasOwnProperty(id)) delete this.pulls[id];
          }
        },
        refreshPulls: function () {
          var self = this;

          // Clear PR
          angular.forEach(self.pulls, function (pull, id) {
            delete self.pulls[id];
          });

          // Update PR lists and status
          var loginsToQuery = [];
          currentTeam.orgs.forEach(function (org) {
            loginsToQuery.push(org);
          });
          if (typeof(currentTeam.members) !== 'undefined') {
            currentTeam.members.forEach(function (user) {
              loginsToQuery.push(user);
            });
          }

          if (loginsToQuery.length) {
            // queries are limited to 5 AND/OR, that gives 6 logins per query
            $q.all(_.chunk(loginsToQuery, 6).map(function (logins) {
              return request(PULLS_QUERY, {
                query: logins.join(' OR ') + ' in:login',
                count: logins.length
              });
            })).then(function (responses) {
              responses.map(function (response) {
                if (typeof response.data.errors !== 'undefined') {
                  throw response.data.errors.map(function (e) { return e.message }).join('\n');
                }

                if (response.data.data) {
                  _.flattenDeep(response.data.data.search.edges
                    .map(function (e) { return e.node.repositories })
                    .map(function (repo) {
                      return repo.edges
                        .map(function (e) {
                          return e.node.pullRequests.edges
                            .filter(function (e) { return !e.length })
                            .map(function (e) { return e.node })
                        })
                        .filter(function (e) { return !!e.length })
                    })
                    .filter(function (e) { return !!e.length })
                  )
                    .filter(function (pull) {
                      return (currentTeam.members || [pull.user.login]).indexOf(pull.user.login) !== -1;
                    })
                    .map(function (pull) {
                      pull.status = pull.headRef.target ? pull.headRef.target.status : {};
                      pull.labels = pull.labels.edges.map(function (e) { return e.node });

                      return pull;
                    })
                    .forEach(function (pull) {
                      console.log(pull.headRef);
                      pullFetcher.pulls[pull.id] = pull;
                    });
                }
              });
            }).then(function() {
              console.log(pullFetcher.pulls);
            });
          }
        }
      };

      var request = function (query, variables) {
        return $http.post(currentApiUrl, {
            query: query,
            variables: variables
        }, { headers: authHeader });
      };

      return pullFetcher;
    }];
  });
