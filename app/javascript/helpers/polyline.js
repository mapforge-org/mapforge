/**
 * Decode an x,y or x,y,z encoded polyline
 * @param {*} encodedPolyline
 * @param {Boolean} includeElevation - true for x,y,z polyline
 * @returns {Array} of coordinates
 */
export function decodePolyline (encodedPolyline, includeElevation) {
  // array that holds the points
  const points = []
  let index = 0
  const len = encodedPolyline.length
  let lat = 0
  let lng = 0
  let ele = 0
  while (index < len) {
    let b
    let shift = 0
    let result = 0
    do {
      b = encodedPolyline.charAt(index++).charCodeAt(0) - 63 // finds ascii
      // and subtract it by 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    lat += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
    shift = 0
    result = 0
    do {
      b = encodedPolyline.charAt(index++).charCodeAt(0) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))

    if (includeElevation) {
      shift = 0
      result = 0
      do {
        b = encodedPolyline.charAt(index++).charCodeAt(0) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      ele += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
    }
    try {
      const location = [(lng / 1E5), (lat / 1E5)]
      if (includeElevation) location.push((ele / 100))
      points.push(location)
    } catch (e) {
      console.log(e)
    }
  }
  return points
}


/**
 * Encode an array of x,y or x,y,z coordinates into a polyline
 * @param {Array} coordinates - Array of coordinates (e.g., [[lng, lat], [lng, lat, ele]])
 * @param {Boolean} includeElevation - true if coordinates include elevation (x, y, z)
 * @returns {String} encoded polyline
 */
export function encodePolyline(coordinates, includeElevation = false) {
  let encodedPolyline = '';
  let prevLat = 0;
  let prevLng = 0;
  let prevEle = 0;

  for (const point of coordinates) {
    const lat = Math.round(point[1] * 1E5);
    const lng = Math.round(point[0] * 1E5);
    const ele = includeElevation && point.length > 2 ? Math.round(point[2] * 100) : 0;

    encodedPolyline += encodeValue(lat - prevLat);
    encodedPolyline += encodeValue(lng - prevLng);

    if (includeElevation) {
      encodedPolyline += encodeValue(ele - prevEle);
    }

    prevLat = lat;
    prevLng = lng;
    prevEle = ele;
  }

  return encodedPolyline;
}

/**
 * Encode a single value using Google's polyline algorithm
 * @param {Number} value - The value to encode
 * @returns {String} encoded value
 */
function encodeValue(value) {
  let encoded = '';
  let v = value < 0 ? ~(value << 1) : (value << 1);
  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);
  return encoded;
}
