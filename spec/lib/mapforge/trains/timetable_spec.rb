require "rails_helper"

RSpec.describe Mapforge::Trains::Timetable do
  let(:now) { Time.utc(2026, 8, 1, 12, 0) }
  let(:names) { { "8001875" => "Eschenau", "8003581" => "Lauf" } }
  let(:api) { instance_double(Mapforge::DbTimetables, plan: {}, changes: {}) }
  let(:timetable) { described_class.new(names, line: "RB21", api: api) }

  # One train calling at both stations: Eschenau 12:10-12:12, Lauf 12:30
  def stop(trip:, departure: nil, arrival: nil, destination: "Gräfenberg")
    { trip: trip, arrival: arrival, departure: departure, destination: destination }
  end

  def eschenau = { "trip-1-6" => stop(trip: "trip-1", arrival: now + 10.minutes, departure: now + 12.minutes) }
  def lauf = { "trip-1-9" => stop(trip: "trip-1", arrival: now + 30.minutes) }

  def stub_plan(eschenau_stops = eschenau, lauf_stops = lauf)
    allow(api).to receive(:plan).with("8001875", anything, line: "RB21").and_return(eschenau_stops)
    allow(api).to receive(:plan).with("8003581", anything, line: "RB21").and_return(lauf_stops)
  end

  describe "#refresh" do
    it "loads the hour before, the current one and the next one on the first call" do
      stub_plan
      timetable.refresh(now)

      expect(api).to have_received(:plan).with("8001875", now - 1.hour, line: "RB21")
      expect(api).to have_received(:plan).with("8001875", now, line: "RB21")
      expect(api).to have_received(:plan).with("8001875", now + 1.hour, line: "RB21")
    end

    it "loads nothing more until the hour turns, then only the hour ahead" do
      stub_plan
      timetable.refresh(now)
      timetable.refresh(now + 30.minutes)
      expect(api).to have_received(:plan).exactly(6).times # 3 hours x 2 stations

      timetable.refresh(now + 1.hour)
      expect(api).to have_received(:plan).with("8001875", now + 2.hours, line: "RB21")
      expect(api).to have_received(:plan).exactly(8).times
    end

    it "forgets stops more than two hours gone when the hour turns" do
      stub_plan({ "old" => stop(trip: "gone", departure: now - 3.hours) }, {})
      timetable.refresh(now)
      expect(timetable.size).to eq(1)

      timetable.refresh(now + 1.hour)
      expect(timetable.size).to eq(0)
    end

    it "asks for deviations once a minute, not on every call" do
      stub_plan
      timetable.refresh(now)
      timetable.refresh(now + 5.seconds)
      expect(api).to have_received(:changes).twice # both stations, once

      timetable.refresh(now + 1.minute)
      expect(api).to have_received(:changes).exactly(4).times
    end

    it "carries on when one station fails" do
      allow(api).to receive(:plan).with("8001875", anything, line: "RB21")
                                  .and_raise(Mapforge::DbTimetables::Error, "GET plan/8001875 returned 503")
      allow(api).to receive(:plan).with("8003581", anything, line: "RB21").and_return(lauf)
      allow(api).to receive(:changes).with("8001875").and_raise(Mapforge::DbTimetables::Error, "boom")

      expect { timetable.refresh(now) }.not_to raise_error
      expect(timetable.size).to eq(1)
    end
  end

  describe "deviations" do
    before { stub_plan }

    it "moves the times of a stop it already knows and leaves the planned ones alone" do
      timetable.refresh(now)
      allow(api).to receive(:changes).with("8001875")
                                     .and_return({ "trip-1-6" => { arrival: now + 15.minutes,
                                                                   departure: now + 16.minutes } })
      timetable.refresh(now + 1.minute)

      moved = timetable.by_station.fetch("8001875").first
      expect(moved[:arrival]).to eq(now + 15.minutes)
      expect(moved[:departure]).to eq(now + 16.minutes)
      expect(moved[:planned_arrival]).to eq(now + 10.minutes)
      expect(moved[:planned]).to eq(now + 12.minutes)
      expect(Mapforge::Trains::Tools.delay(moved)).to eq(5)
    end

    it "ignores changes for stops of other lines and empty ones" do
      timetable.refresh(now)
      allow(api).to receive(:changes).with("8001875")
                                     .and_return({ "someone-else" => { departure: now },
                                                   "trip-1-6" => { arrival: nil, departure: nil } })
      timetable.refresh(now + 1.minute)

      expect(timetable.size).to eq(2)
      expect(timetable.by_station.fetch("8001875").first[:arrival]).to eq(now + 10.minutes)
    end
  end

  describe "#trips" do
    it "groups the stops of one train across stations, in travel order" do
      stub_plan
      timetable.refresh(now)

      expect(timetable.trips.keys).to eq([ "trip-1" ])
      expect(timetable.trips.fetch("trip-1").map { |s| s[:eva] }).to eq([ "8001875", "8003581" ])
    end

    it "drops a stop with no time at all, a train cannot be placed by one" do
      stub_plan(eschenau.merge("no-time" => stop(trip: "trip-2")), {})
      timetable.refresh(now)

      expect(timetable.size).to eq(2)
      expect(timetable.trips.keys).to eq([ "trip-1" ])
    end
  end

  describe "#next_time" do
    before { stub_plan }

    it "is the earliest stop still ahead" do
      timetable.refresh(now)

      expect(timetable.next_time(now)).to eq(now + 12.minutes) # the departure, not the arrival
      expect(timetable.next_time(now + 20.minutes)).to eq(now + 30.minutes)
      expect(timetable.next_time(now + 1.hour)).to be_nil
    end
  end

  it "asks for every train when no line is given" do
    plain = described_class.new({ "8001875" => "Eschenau" }, api: api)
    plain.refresh(now)

    expect(api).to have_received(:plan).with("8001875", now, line: nil)
  end
end
