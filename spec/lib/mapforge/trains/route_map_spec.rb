require "rails_helper"

RSpec.describe Mapforge::Trains::RouteMap do
  subject(:route) { described_class.new(map.private_id, line: "RB21") }

  # A straight track west to east at 49°N, ~3.6 km between vertices. Stations sit on the vertices,
  # because LineIndex#distance_at snaps to the nearest one.
  let(:track) { [ [ 11.0, 49.0 ], [ 11.05, 49.0 ], [ 11.1, 49.0 ] ] }
  let(:map) { create(:map) }
  let(:layer) { map.layers.first }
  let(:now) { Time.utc(2026, 8, 1, 12, 0) }

  def add_point(coordinates, properties)
    layer.features.create!(geometry: { "type" => "Point", "coordinates" => coordinates },
                           properties: properties)
  end

  def build_route
    layer.features.create!(geometry: { "type" => "LineString", "coordinates" => track }, properties: {})
    # deliberately out of order, the class sorts by distance along the track
    # label-title is the station name route_setup leaves on the dot, the board goes below it
    add_point(track.last, { "title" => "Gräfenberg", "eva" => "3", "label-title" => "Gräfenberg" })
    add_point(track.first, { "title" => "Eschenau", "eva" => "1", "label-title" => "Eschenau" })
    add_point(track[1], { "title" => "Lauf", "eva" => "2", "label-title" => "Lauf" })
  end

  # One train running Eschenau 12:00 -> Lauf 12:10/12:12 -> Gräfenberg 12:30, all of it on time
  def trips(delay: 0)
    late = delay.minutes
    [ { eva: "1", planned: now, departure: now + late, destination: "Gräfenberg" },
      { eva: "2", planned_arrival: now + 10.minutes, planned: now + 12.minutes,
        arrival: now + 10.minutes + late, departure: now + 12.minutes + late, destination: "Gräfenberg" },
      { eva: "3", planned_arrival: now + 30.minutes, planned: now + 30.minutes,
        arrival: now + 30.minutes + late, destination: "Gräfenberg" } ]
      .then { |stops| { "trip-1" => stops } }
  end

  def by_station(stops = trips.fetch("trip-1")) = stops.group_by { |stop| stop[:eva] }

  describe "setup" do
    it "names what is missing rather than failing obscurely" do
      expect { described_class.new("nope") }
        .to raise_error(described_class::Error, /No map with private id "nope"/)
      expect { described_class.new(map.private_id) }
        .to raise_error(described_class::Error, /No track on the map/)

      layer.features.create!(geometry: { "type" => "LineString", "coordinates" => track }, properties: {})
      add_point(track.first, { "title" => "Eschenau" })
      expect { described_class.new(map.private_id) }
        .to raise_error(described_class::Error, /No station carries an eva number/)
    end

    it "measures the track and orders the stations along it" do
      build_route

      expect(route.length).to be_within(50).of(7300)
      expect(route.stations.map { |station| station[:name] }).to eq([ "Eschenau", "Lauf", "Gräfenberg" ])
      expect(route.stations.map { |station| station[:distance] })
        .to match([ 0, be_within(50).of(3650), be_within(50).of(7300) ])
      expect(route.station_names).to eq({ "1" => "Eschenau", "2" => "Lauf", "3" => "Gräfenberg" })
    end

    it "sweeps up trains an earlier run left behind" do
      build_route
      leftover = add_point(track[1], { "trip_id" => "old-trip" })

      expect { route }.to change { Feature.where(id: leftover.id).count }.from(1).to(0)
      expect(route.stations.size).to eq(3)
    end
  end

  describe "#show_trains" do
    before { build_route }

    it "places a train between the stations it is running between" do
      descriptions = route.show_trains(trips, now + 5.minutes)

      train = layer.features.point.detect { |feature| feature.properties["trip_id"] == "trip-1" }
      expect(train.geometry["coordinates"].first).to be_within(0.001).of(11.025) # half way to Lauf
      expect(train.properties).to include("title" => "RB21 → Gräfenberg", "marker-color" => "#33d17a")
      expect(descriptions).to eq([ "RB21 → Gräfenberg at 1.8 km" ])
    end

    it "moves the same feature on rather than adding another one" do
      route.show_trains(trips, now + 5.minutes)
      train = layer.features.point.detect { |feature| feature.properties["trip_id"] == "trip-1" }

      expect { route.show_trains(trips, now + 8.minutes) }.not_to change { layer.features.point.count }
      expect(train.reload.geometry["coordinates"].first).to be_within(0.001).of(11.04)
    end

    it "reports the delay in the description and on the marker" do
      # six late, so it only leaves at 12:06 and is half way to Lauf at 12:11
      descriptions = route.show_trains(trips(delay: 6), now + 11.minutes)

      train = layer.features.point.detect { |feature| feature.properties["trip_id"] == "trip-1" }
      expect(train.properties).to include("label" => "→ Gräfenberg (+6)", "marker-color" => "#ff7800")
      expect(descriptions.first).to end_with("+6 min late")
    end

    it "takes the train off the map once it has arrived" do
      route.show_trains(trips, now + 5.minutes)

      expect(route.show_trains(trips, now + 1.hour)).to be_empty
      expect(layer.features.point.count).to eq(3) # the stations, no train
    end

    it "puts nothing on the map before the first departure" do
      expect(route.show_trains(trips, now - 1.hour)).to be_empty
      expect(layer.features.point.count).to eq(3)
    end
  end

  describe "#show_boards" do
    before { build_route }

    it "writes the departure board below the station name" do
      route.show_boards(by_station, now)

      eschenau = route.stations.first[:feature]
      # 12:00 UTC is 14:00 in Berlin
      expect(eschenau.properties).to include("label" => "14:00 → Gräfenberg",
                                             "label-title" => "Eschenau")
    end

    it "leaves a station whose board has not moved alone" do
      route.show_boards(by_station, now)
      before = route.stations.first[:feature].updated_at

      route.show_boards(by_station, now)
      expect(route.stations.first[:feature].updated_at).to eq(before)
    end

    it "empties the board of a station once its departures have gone" do
      route.show_boards(by_station, now)
      route.show_boards(by_station, now + 1.hour)

      expect(route.stations.first[:feature].properties["label"]).to eq("")
    end
  end

  describe "#clear" do
    before { build_route }

    it "takes the trains and the boards down, leaving the station names" do
      route.show_trains(trips, now + 5.minutes)
      route.show_boards(by_station, now)

      route.clear

      expect(layer.features.point.count).to eq(3)
      expect(route.stations.map { |station| station[:feature].properties.keys }.flatten)
        .not_to include("label")
      expect(route.stations.first[:feature].properties).to include("label-title" => "Eschenau")
    end

    it "does nothing to a station that never got a board" do
      expect { route.clear }.not_to change { route.stations.first[:feature].updated_at }
    end
  end
end
