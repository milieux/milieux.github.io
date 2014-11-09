(function init(){

    'use strict';

    var airports, airlines;
    var flightsData;

    var map;

    var dayChart = dc.rowChart('#day-chart');
    var airlineChart = dc.barChart('#airline-chart');
    var distanceChart = dc.barChart('#distance-chart');
    var depDelayChart = dc.barChart('#dep-delay-chart');


    function drawCharts(data){
        d3.selectAll('.hidden').classed('hidden', false);

        var flights = crossfilter(data);

        var dest, distanceGroup;
        var destDelay, depDelayGroup;
        var airline, airlineGroup;
        var days, daysGroup;


        function setupDistanceChart(){
            dest = flights.dimension(function(d){
                return d.dest;
            });

            distanceGroup = dest.group().reduce(
                function (p, v){
                    p.total++;
                    p.distance += +v.distance;
                    p.avgDistance = p.distance / p.total;
                    return p;
                },
                function (p, v){
                    p.total--;
                    p.distance -= +v.distance;
                    p.avgDistance = p.distance / p.total;
                    return p;
                },
                function (){
                    return {
                        total: 0,
                        distance: 0,
                        avgDistance: 0
                    };
            })
            .order(function(d){
                return -d.avgDistance;
            });

            distanceGroup.all = function(){
                return distanceGroup.top(Infinity);
            };

            // Destination distance - bar chart
            distanceChart.width(800)
                .height(240)
                .margins({top: 10, right: 10, bottom: 30, left: 45})
                .dimension(dest)
                .group(distanceGroup)
                .transitionDuration(500)
                .centerBar(true)
                .x(d3.scale.ordinal().domain(dest))
                .xUnits(dc.units.ordinal)
                .elasticY(true)
                .yAxisLabel('Distance in miles')
                .valueAccessor(function(d) {
                    return d.value.avgDistance;
                })
                .ordinalColors(['#E1B74D'])
                .renderHorizontalGridLines(true)
                .title(function(d){
                    var airport = getAirportInfo(d.key);
                    var name = airport ? airport.name : d.key;
                    return name + '\nDistance (in miles): ' + d.value.avgDistance;
                })
                .gap(1)
                .xAxisLabel('Destination airports (hover on chart to see details)')
                .xAxis().tickFormat(function(d) { return ''; });
        }

        function setupDelayChart(){
            destDelay = flights.dimension(function(d){
                return d.dest;
            });

            depDelayGroup = destDelay.group()
                .reduce(reduceAddDelay, reduceRemoveDelay, reduceInitialDelay)
                .order(function(d){
                    return -d.avgDepDelayTime;
                });

            depDelayGroup.all = function(){
                return depDelayGroup.top(Infinity);
            };

            // Avg delay by destination distance - bar chart
            depDelayChart.width(800)
                .height(240)
                .margins({top: 10, right: 10, bottom: 30, left: 45})
                .dimension(destDelay)
                .group(depDelayGroup)
                .transitionDuration(500)
                .centerBar(false)
                .x(d3.scale.ordinal().domain(destDelay))
                .xUnits(dc.units.ordinal)
                .elasticY(false)
                .yAxisLabel('Delay time in minutes')
                .valueAccessor(function(d) {
                    return d.value.avgDepDelayTime;
                })
                .colors(d3.scale.ordinal().domain(['late', 'early']).range(['#BB302F', '#849823']))
                .colorAccessor(function(d) {
                    if (d.value.avgDepDelayTime > 0) {
                        return 'late';
                    }
                    return 'early';
                })
                .renderHorizontalGridLines(true)
                .title(function(d){
                    var airport = getAirportInfo(d.key);
                    var name = airport ? airport.name : d.key;
                    return name + '\nAverage delay time (in mins): ' + d3.round(d.value.avgDepDelayTime);
                })
                .xAxisLabel('Destination airports (hover on chart to see details)')
                .xAxis().tickFormat(function(d) { return ''; });
        }

        function setupAirlineChart() {
            airline = flights.dimension(function(d){
                return d.unique_carrier;
            });

            airlineGroup = airline.group()
                .reduce(reduceAddDelay, reduceRemoveDelay, reduceInitialDelay)
                .order(function(d){
                    return -d.avgDepDelayTime;
                });

            airlineGroup.all = function(){
                return airlineGroup.top(Infinity);
            };

            // Airline performance - bar chart
            airlineChart.width(360)
                .height(240)
                .margins({top: 10, right: 10, bottom: 30, left: 40})
                .dimension(airline)
                .group(airlineGroup)
                .transitionDuration(500)
                .centerBar(true)
                .x(d3.scale.ordinal().domain(airlineGroup))
                .xUnits(dc.units.ordinal)
                .elasticY(true)
                .yAxisLabel('Delay time in minutes')
                .valueAccessor(function(d) {
                    return d.value.avgDepDelayTime;
                })
                .colors(d3.scale.ordinal().domain(['late', 'early']).range(['#BB302F', '#849823']))
                .colorAccessor(function(d) {
                    if (d.value.avgDepDelayTime > 0) {
                        return 'late';
                    }
                    return 'early';
                })
                .renderHorizontalGridLines(true)
                .title(function(d){
                    var airline = getAirlineInfo(d.key);
                    var name = airline ? airline.description : d.key;
                    return name + '\nNumber of flights: ' + d.value.totalFlights + '\nAvg delay time (in mins): ' + d3.round(d.value.avgDepDelayTime) + '\nCancellations: ' + d.value.totalDelays;
                })
                .xAxisLabel('Airlines (hover on chart to see details)')
                .xAxis().tickFormat(function(d) { return ''; });
        }

        function setupDaysChart() {
            days = flights.dimension(function(d) {
                var day = +d.day_of_week - 1;
                var name = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                return day + '.' + name[day];
            });

            daysGroup = days.group();

            // Flights availability - row chart
            dayChart.width(240)
                .height(240)
                .margins({top: 20, left: 10, right: 10, bottom: 20})
                .group(daysGroup)
                .dimension(days)
                .transitionDuration(500)
                .ordinalColors(['#9b8063', '#866f56', '#725e49', '#5d4d3b', '#483c2e', '#332a21', '#1f1914'])
                .elasticX(true)
                .label(function (d) {
                    return d.key.split('.')[1];
                })
                .title(function (d) {
                    return 'Number of flights: ' + d.value;
                })
                .xAxis().ticks(4);
        }

        function reduceAddDelay(p, v){
            p.totalFlights++;
            p.totalDepDelayTime += +v.dep_delay;
            p.avgDepDelayTime = p.totalDepDelayTime / p.totalFlights;
            if (+v.cancelled == 1) p.totalDelays++;
            return p;
        }

        function reduceRemoveDelay(p, v){
            p.totalFlights--;
            p.totalDepDelayTime -= +v.dep_delay;
            p.avgDepDelayTime = p.totalDepDelayTime / p.totalFlights;
            if (+v.cancelled == 1) p.totalDelays--;
            return p;
        }

        function reduceInitialDelay(){
            return {
                totalFlights: 0,
                totalDepDelayTime: 0,
                avgDepDelayTime: 0,
                totalDelays: 0
            };
        }

        function resetCharts(e){
            var maps = {
                'dep-delay-chart': depDelayChart,
                'distance-chart': distanceChart,
                'airline-chart': airlineChart,
                'day-chart': dayChart
            };

            var container = $(e.target).closest('.dc-chart').attr('id');
            var chart = maps[container];

            chart.filterAll();
            dc.redrawAll();
        }

        setupDistanceChart();
        setupDelayChart();
        setupAirlineChart();
        setupDaysChart();

        dc.renderAll();
        $('.reset').on('click', resetCharts);
    }

    function drawMap(originator, destinations){
        var paths = [];
        var bubbles = [];

        destinations.forEach(function(dest){
            var bubble = $.extend(dest, {
                radius: 7,
                fillKey: 'destination'
            });
            bubbles.push(bubble);

            var destCoordinates = {
                latitude: dest.latitude ? dest.latitude : originator.latitude,
                longitude: dest.longitude ? dest.longitude : originator.longitude
            };

            var path = {
                origin: {
                    latitude: originator.latitude,
                    longitude: originator.longitude
                },
                destination: destCoordinates
            };
            paths.push(path);
        });

        originator.radius = 10;
        originator.fillKey = 'origin';

        bubbles.push(originator);

        map.bubbles(bubbles, {
            popupTemplate: function(geo, data) {
                var html = '<div class="hover-info">' + data.iataCode + ' - ' + data.name;
                    html += '</div>';
                return html;
            }
        });

        map.arc(paths, {
            strokeWidth: 1,
            arcSharpness: 2,
            strokeColor: '#451500'
        });
    }

    function getFlightsDataByOrigin(value){
        return flightsData.filter(function(d){
            return d.origin === value;
        });
    }

    function getAirportInfo(code){
        return airports.filter(function(d){
            return d.iataCode === code;
        })[0];
    }

    function getAirlineInfo(code){
        return airlines.filter(function(d){
            return d.code === code;
        })[0];
    }

    function onDestinationChanged(evt, selected) {
        var flights = getFlightsDataByOrigin(selected.iataCode);

        if (!flights.length) {
            $('.msg').addClass('in');
            $(this).addClass('error').select();
            return;
        }

        $(this).removeClass('error');
        $('.msg').removeClass('in');

        var routes = flights.map(function(route){
            var airportInfo = _.findWhere(airports, { iataCode: route.dest });

            if (airportInfo === undefined) {
                return route;
            }

            var destInfo = $.extend(route, airportInfo);

            return destInfo;
        });

        routes = routes.filter(function(route){
            return route.latitude || route.longitude;
        });

        drawMap(selected, routes);
        drawCharts(flights);
    }

    function initializeInput(){
       var engine = new Bloodhound({
            name: 'airports',
            local: airports,
            limit: 10,
            datumTokenizer: function(d) {
                var keywords = [d.name, d.iataCode, d.city].join(' ');
                return Bloodhound.tokenizers.whitespace(keywords);
            },
            queryTokenizer: Bloodhound.tokenizers.whitespace
        });

        engine.initialize();

        $('#dep').typeahead(null, {
            name: 'airports',
            displayKey: 'name',
            source: engine.ttAdapter()
        })
        .on('typeahead:selected', onDestinationChanged);
    }

    function initializeMap(){
        map = new Datamap({
            element: document.getElementById('map'),
            scope: 'usa',
            fills: {
                origin: '#AA2519',
                destination: '#e75f2b',
                defaultFill: '#E9D3A1'
            },
            geographyConfig: {
                popupOnHover: false,
                highlightOnHover: false
            },
            setProjection: function(element, options) {
                var projection = d3.geo.albersUsa()
                        .scale(element.offsetWidth)
                        .translate([element.offsetWidth / 2.5, element.offsetHeight / 2]);

                var path = d3.geo.path().projection(projection);
                return {
                    path: path,
                    projection: projection
                };
            }
        });
    }

    function fetchAirlinesData(){
        d3.csv('data/airlines.csv', function(data){
            airlines = data;
        });
    }

    function fetchAirportsData(){
        d3.csv('data/airports.csv', function(data){
            airports = data.map(function(d){
                return {
                    iataCode: d.iata_code,
                    name: d.name,
                    city: d.municipality,
                    latitude: d.latitude_deg,
                    longitude: d.longitude_deg
                };
            });

            initializeInput();
        });
    }

    function fetchFlightsData(){
        d3.json('data/ontime_data_test.json', function(data){
            flightsData = data;
            $('#dep').prop('disabled', false);
        });
    }

    fetchFlightsData();
    fetchAirlinesData();
    fetchAirportsData();

    initializeMap();

}());
