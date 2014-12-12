var rendererOptions = {
  draggable: true,
  polylineOptions: {strokeColor: 'red', strokeWeight: 1 },
  preserveViewport: true,
  suppressMarkers: true,
};
var map;
var directionsService = new google.maps.DirectionsService();
var elevationService = new google.maps.ElevationService();

var elevBubble = new google.maps.InfoWindow();
var elevMarker = new google.maps.Marker();

var Segment = function(){
  this.distance = 0;
};

Segment.prototype.getDistance = function() {
  if (this.followRoads) {
    return this.leg.distance.value;
  } else {
    return this.distance;
  }
}

var currentSegment = null;
var segments = [];

var totalDistance = 0.0;

var followRoads = true;

var ranchosa = new google.maps.LatLng(37.332332, -122.144373);

function initialize() {

  var mapOptions = {
    zoom: 15,
    center: ranchosa,
    mapTypeId: google.maps.MapTypeId.TERRAIN
  };
  map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

  google.maps.event.addListener(map, 'click', function(event) {

    var marker = new google.maps.Marker({
        position: event.latLng,
        map: map
    });

    google.maps.event.addListener(marker, 'rightclick', function(event) {
      elevBubble.setContent('foo');
      elevBubble.open(map, marker);
    });

    if (currentSegment != null) {
      currentSegment.endMarker = marker;
      followRoads = document.getElementById("followRoads").checked;
      currentSegment.followRoads = followRoads;

      segments.push(currentSegment);

      if (followRoads) {
        var directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);
        directionsDisplay.setMap(map);
        var request = {
          origin: currentSegment.startMarker.getPosition(),
          destination: currentSegment.endMarker.getPosition(),
          travelMode: google.maps.TravelMode.WALKING
        };
        directionsService.route(request, function(response, status) {
          if (status == google.maps.DirectionsStatus.OK) {
            var thisSegment = segments[segments.length-1];

            thisSegment.directionsDisplay = directionsDisplay;

            directionsDisplay.setDirections(response);
            var route = response.routes[0];
            var leg = route.legs[0];

            thisSegment.leg = leg;
            thisSegment.startMarker.setPosition(leg.start_location);
            thisSegment.endMarker.setPosition(leg.end_location);

            /* when the start pos has moved and is the end point of
               a previous segment that doesn't follow roads, we have to
               update it: */
            if (segments.length >= 2) {
              var prevSegment = segments[segments.length-2];
              if (!prevSegment.followRoads) {
                updateSegmentNoFollow(prevSegment);
              }
            }
            updateDistance();

            /* user may drag the segment, changing the length: */
            directionsDisplay.segment = thisSegment;
            google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
              var segment = directionsDisplay.segment;
              /* looks like a totally new object DirectionsResult will be created,
                 so the leg will be not valid any more: */
              var result = directionsDisplay.getDirections();
              var route = result.routes[0];
              var leg = route.legs[0];
              segment.leg = leg;
              updateDistance();
            });

          }
        });
      } else {
        /* do not follow roads */
        updateSegmentNoFollow(currentSegment);
        updateDistance();
      }
    }
    currentSegment = new Segment();
    currentSegment.startMarker = marker;
    currentSegment.endMarker = null;

  });

  google.maps.event.addListener(map, 'rightclick', function(event) {
    elevMarker.setPosition(event.latLng);
    elevMarker.setMap(map);

    var locations = [];
    locations.push(event.latLng);
    var request = { 'locations': locations };
    elevationService.getElevationForLocations(request, function(results, status) {
      if (status == google.maps.ElevationStatus.OK) {
        if (results[0]) {
          var elevation = results[0].elevation;
          elevBubble.setContent(elevation.toFixed(0) + 'm/' + (elevation*3.28084).toFixed(0) + 'ft');
          elevBubble.open(map, elevMarker);

          document.getElementById('elevation').innerHTML = elevation.toFixed(0) + ' m';
        } else {
          alert("no results");
        }
      } else {
        alert("couldn't get elevation");
      }
    });
  });

  google.maps.event.addListener(elevBubble, 'closeclick', function() {
    elevMarker.setMap(null);
  });

}

function updateSegmentNoFollow(seg) {
  var points = [];
  points.push(seg.startMarker.getPosition());
  points.push(seg.endMarker.getPosition());
  if (seg.line != null) {
    seg.line.setMap(null);
  }
  seg.line = new google.maps.Polyline({path: points, map: map, strokeWeight: 1, strokeColor: 'blue' });

  seg.distance = google.maps.geometry.spherical.computeLength(points);
}

function updateDistance() {
   var i;
   totalDistance = 0;
   for (i = 0; i < segments.length; i++) {
     totalDistance += segments[i].getDistance();
   }

   document.getElementById('total').innerHTML =
     (totalDistance/1000.0).toFixed(2) + ' km / ' + 
     (totalDistance/1609.34).toFixed(2) + ' miles';
}

function destroyLastSegment(segment) {
  if (segment.endMarker) {
    segment.endMarker.setMap(null);
  }
  if (segment.directionsDisplay) {
    segment.directionsDisplay.setMap(null);
  }
  if (segment.line) {
    segment.line.setMap(null);
  }
}

function deleteLastPoint() {
  var lastSegment = segments.pop();

  if (lastSegment) {
    destroyLastSegment(lastSegment);
    currentSegment.startMarker = lastSegment.startMarker;
  } else {
    if (currentSegment != null) {
      currentSegment.startMarker.setMap(null);
      currentSegment = null;
    }
  }
  updateDistance();
}

function clearAll() {
  for (i = 0; i < segments.length; i++) {
    destroyLastSegment(segments[i]);
  }
  if (segments.length > 0) {
    segments[0].startMarker.setMap(null);
  }
  segments = [];
  if (currentSegment != null) {
    currentSegment.startMarker.setMap(null);
    currentSegment = null;
  }
  updateDistance();
}

google.maps.event.addDomListener(window, 'load', initialize);

