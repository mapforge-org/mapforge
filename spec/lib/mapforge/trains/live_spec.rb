require "rails_helper"

RSpec.describe Mapforge::Trains::Live do
  subject(:live) { described_class.new(map.private_id) }

  let(:map) { create(:map) }
  let(:layer) { map.layers.first }
  # Everything the API would answer, so a run touches nothing but the map
  let(:timetable) do
    instance_double(Mapforge::Trains::Timetable,
      refresh: nil, trips: trips, by_station: {}, size: 2, next_time: nil)
  end

  # A straight track west to east at 49°N with a station on either vertex, ~3.6 km apart
  def track = [ [ 11.0, 49.0 ], [ 11.05, 49.0 ] ]

  # One train, half way along the track right now, so a tick has something to place
  def trips
    now = Time.current
    { "trip-1" => [ { eva: "1", planned: now - 5.minutes, departure: now - 5.minutes,
                      destination: "Gräfenberg" },
                    { eva: "2", planned_arrival: now + 5.minutes, planned: now + 5.minutes,
                      arrival: now + 5.minutes, destination: "Gräfenberg" } ] }
  end

  before do
    layer.features.create!(geometry: { "type" => "LineString", "coordinates" => track },
                           properties: { "line" => "RB21" })
    { "1" => track.first, "2" => track.last }.each do |eva, coordinates|
      layer.features.create!(geometry: { "type" => "Point", "coordinates" => coordinates },
                             properties: { "title" => "Station #{eva}", "eva" => eva })
    end
    allow(Mapforge::Trains::Timetable).to receive(:new).and_return(timetable)
    allow(Rails.logger).to receive(:info)
    # Kernel#sleep, so an example does not wait out the interval. The loop itself runs for real.
    allow(live).to receive(:sleep) # rubocop:disable RSpec/SubjectStub
  end

  it "logs the route it is about to animate" do
    expect(Rails.logger).to have_received(:info).with(/Track is 3.7 km long with 2 stations/)
    expect(Rails.logger).to have_received(:info).with(/at   0.0 km  Station 1 +eva 1/)
  end

  # Stopping from inside the refresh ends the run after exactly one tick, the sleep of that tick
  # being the only thing between the two
  it "writes one round of positions per tick and takes them down again when stopped" do
    allow(timetable).to receive(:refresh) { live.stop }
    allow(live.route).to receive(:show_trains).and_call_original

    live.run

    expect(live.route).to have_received(:show_trains).once
    expect(Rails.logger).to have_received(:info).with(/1 trains running: RB21 → Gräfenberg at 1.8 km/)
    expect(layer.features.point.count).to eq(2) # the stations, the train was cleared off again
  end

  it "logs when the next train is due while none is running" do
    allow(timetable).to receive(:refresh) { live.stop }
    allow(timetable).to receive_messages(trips: {}, next_time: Time.utc(2026, 8, 1, 12, 0))

    live.run

    # 12:00 UTC is 14:00 in Berlin, the zone the API reports in
    expect(Rails.logger).to have_received(:info)
      .with(/No trains running, 2 stops known, next one at 01.08. 14:00/)
  end
end
