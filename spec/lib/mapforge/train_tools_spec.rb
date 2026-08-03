require "rails_helper"

RSpec.describe Mapforge::TrainTools do
  let(:start) { Time.utc(2026, 8, 1, 12, 0) }
  # origin at 0m (departs 12:00), a middle stop at 1000m (12:10-12:12), terminus at 3000m (12:30)
  let(:stops) do
    [ { distance: 0, arrival: nil, departure: start },
      { distance: 1000, arrival: start + 10.minutes, departure: start + 12.minutes },
      { distance: 3000, arrival: start + 30.minutes, departure: nil } ]
  end

  def distance_at(time) = described_class.distance_at(stops, time)

  it "returns nil outside the trip window" do
    expect(distance_at(start - 1.second)).to be_nil
    expect(distance_at(start + 30.minutes + 1.second)).to be_nil
  end

  it "holds the train at a station while it dwells" do
    expect(distance_at(start)).to eq(0)
    expect(distance_at(start + 10.minutes)).to eq(1000)
    expect(distance_at(start + 11.minutes)).to eq(1000)
    expect(distance_at(start + 12.minutes)).to eq(1000)
    expect(distance_at(start + 30.minutes)).to eq(3000)
  end

  it "interpolates linearly between two stations" do
    expect(distance_at(start + 5.minutes)).to eq(500)
    expect(distance_at(start + 21.minutes)).to eq(2000)
  end

  it "returns nil without at least two timed stops" do
    expect(described_class.distance_at([ stops.first ], start)).to be_nil
    expect(described_class.distance_at([], start)).to be_nil
  end

  describe ".stops" do
    let(:route) do
      Mapforge::OsmElement.new(
        [ { "type" => "node", "id" => 1, "lon" => 11.0, "lat" => 49.0, "tags" => { "name" => "Start" } },
          { "type" => "node", "id" => 2, "lon" => 11.1, "lat" => 49.0 },
          { "type" => "node", "id" => 4, "lon" => 11.3, "lat" => 49.0, "tags" => { "name" => "End" } },
          { "type" => "relation", "id" => 99, "members" =>
            [ { "type" => "node", "ref" => 1, "role" => "stop_entry_only" },
              { "type" => "node", "ref" => 4, "role" => "stop" },
              { "type" => "node", "ref" => 2, "role" => "platform" },
              { "type" => "way", "ref" => 13, "role" => "" } ] } ],
        "relation", 99
      )
    end

    it "returns only stop members, in travel order" do
      expect(described_class.stops(route).map { |node| node["tags"]["name"] }).to eq([ "Start", "End" ])
    end
  end

  describe ".next_departures" do
    # everything a single station reports: two directions, one of them twice, one already gone
    let(:departures) do
      [ { destination: "Gräfenberg", departure: start + 20.minutes },
        { destination: "Gräfenberg", departure: start + 80.minutes },
        { destination: "Nürnberg Nordost", departure: start + 5.minutes },
        { destination: "Nürnberg Nordost", departure: start - 5.minutes },
        { destination: "Gräfenberg", departure: nil, arrival: start + 3.minutes } ]
    end

    it "keeps the earliest upcoming departure per destination, in departure order" do
      expect(described_class.next_departures(departures, start))
        .to eq([ departures[2], departures[0] ])
    end

    it "is empty once every departure has gone" do
      expect(described_class.next_departures(departures, start + 2.hours)).to be_empty
    end
  end
end
