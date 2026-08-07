require "rails_helper"

RSpec.describe Mapforge::Trains::Tools do
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

  it "leaves 20 seconds after the departure the API reports" do
    expect(distance_at(start + 20.seconds)).to eq(0)
    expect(distance_at(start + 21.seconds)).to be > 0
    expect(distance_at(start + 12.minutes + 20.seconds)).to eq(1000)
    expect(distance_at(start + 12.minutes + 21.seconds)).to be > 1000
  end

  it "keeps a train that arrived on time waiting for a late departure" do
    late = [ stops[0], stops[1].merge(departure: start + 25.minutes), stops[2] ]

    expect(described_class.distance_at(late, start + 20.minutes)).to eq(1000)
  end

  it "interpolates linearly between two stations" do
    # half way through 12:00:20-12:10 and through 12:12:20-12:30
    expect(distance_at(start + 5.minutes + 10.seconds)).to eq(500)
    expect(distance_at(start + 21.minutes + 10.seconds)).to eq(2000)
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

  describe ".delay" do
    it "measures an arrival against the planned arrival, not the planned departure" do
      # planned 12:10-12:12, running two minutes late. Against the planned departure the arrival
      # would look as if it were on time.
      stop = { planned_arrival: start + 10.minutes, planned: start + 12.minutes,
               arrival: start + 12.minutes, departure: start + 14.minutes }

      expect(described_class.delay(stop)).to eq(2)
    end

    it "falls back to the planned departure where the stop has no arrival" do
      stop = { planned_arrival: nil, planned: start, arrival: nil, departure: start + 5.minutes }

      expect(described_class.delay(stop)).to eq(5)
    end

    it "is negative for a train running early" do
      expect(described_class.delay({ planned: start, departure: start - 1.minute })).to eq(-1)
    end
  end

  describe ".train_properties" do
    def properties(minutes, at: start)
      stops = [ { destination: "Gräfenberg", planned: at, departure: at + minutes.minutes } ]
      described_class.train_properties("trip-1", stops, start, line: "RB21")
    end

    it "names the train after the line and the first destination it carries" do
      nameless = [ { planned: start, departure: start } ]

      expect(properties(0)["title"]).to eq("RB21 → Gräfenberg")
      expect(described_class.train_properties("t", nameless, start)["title"]).to eq("→")
    end

    it "goes from green to orange at 5 and to red at 15 minutes late" do
      expect(properties(4)["marker-color"]).to eq("#33d17a")
      expect(properties(5)["marker-color"]).to eq("#ff7800")
      expect(properties(14)["marker-color"]).to eq("#ff7800")
      expect(properties(15)["marker-color"]).to eq("#e01b24")
    end

    it "haloes the label in a light version of the marker color" do
      expect(properties(0)["label-shadow"]).to eq("#cdf1d7")
      expect(properties(15)["label-shadow"]).to eq("#f6bbbd")
    end

    it "labels the train with where it is heading and the delay where there is one" do
      expect(properties(7)["label"]).to eq("→ Gräfenberg (+7)")
      expect(properties(0)["label"]).to eq("→ Gräfenberg")
    end

    it "counts a train past its last stop as on time" do
      stops = [ { planned: start, departure: start + 20.minutes } ]

      expect(described_class.train_properties("t", stops, start + 1.hour)["marker-color"]).to eq("#33d17a")
    end
  end

  describe ".board_label" do
    # The board reads in the zone the DB API reports in, whatever the server clock says. August, so
    # 10:00 UTC is 12:00 in Berlin.
    let(:noon) { Time.utc(2026, 8, 1, 10, 0) }

    def board_label(stops, time) = described_class.board_label(stops, time)

    it "puts the planned arrival in brackets and the delay behind the destination" do
      stops = [ { destination: "Gräfenberg", planned_arrival: noon + 8.minutes,
                  planned: noon + 10.minutes, departure: noon + 12.minutes } ]

      expect(board_label(stops, noon)).to eq("12:10 (12:08) → Gräfenberg (+2)")
    end

    it "leaves out the brackets where the train starts here, and the delay where there is none" do
      stops = [ { destination: "Gräfenberg", planned: noon + 10.minutes, departure: noon + 10.minutes } ]

      expect(board_label(stops, noon)).to eq("12:10 → Gräfenberg")
    end

    it "shows a train that ends here as its arrival alone, without a destination" do
      stops = [ { planned_arrival: noon + 35.minutes, planned: noon + 35.minutes, arrival: noon + 37.minutes },
                { destination: "Nürnberg", planned: noon + 40.minutes, departure: noon + 40.minutes } ]

      expect(board_label(stops, noon)).to eq("12:35 (+2)\n12:40 → Nürnberg")
    end

    it "is one line per destination, earliest first, and empty once nothing is due" do
      stops = [ { destination: "Gräfenberg", planned: noon + 20.minutes, departure: noon + 20.minutes },
                { destination: "Nürnberg", planned: noon + 5.minutes, departure: noon + 5.minutes } ]

      expect(board_label(stops, noon)).to eq("12:05 → Nürnberg\n12:20 → Gräfenberg")
      expect(board_label(stops, noon + 1.hour)).to eq("")
    end
  end
end
