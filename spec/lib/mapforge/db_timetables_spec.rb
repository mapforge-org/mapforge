require "rails_helper"

RSpec.describe Mapforge::DbTimetables do
  let(:client) { described_class.new(client_id: "id", api_key: "key") }
  let(:stop_id) { "4344706044913795844-2608011938-6" }

  let(:plan_xml) do
    <<~XML
      <timetable station="Eschenau(Mittelfr)">
        <s id="4344706044913795844-2608011938-6">
          <tl f="N" t="p" o="800720" c="RB" n="58768"/>
          <ar pt="2608011953" pp="2" l="RB21" fb="RB21" ppth="Gräfenberg|Weißenohe|Forth"/>
          <dp pt="2608011955" pp="2" l="RB21" fb="RB21" ppth="Großgeschaidt|Heroldsberg|Nürnberg Nordost"/>
        </s>
        <s id="9002536610000000001-2608011940-1">
          <tl f="N" t="p" o="800519" c="RB" n="22110"/>
          <dp pt="2608011940" pp="1" l="RB22" fb="RB22" ppth="Lauf links Pegnitz"/>
        </s>
      </timetable>
    XML
  end

  let(:changes_xml) do
    <<~XML
      <timetable station="Eschenau(Mittelfr)">
        <s id="4344706044913795844-2608011938-6">
          <ar ct="2608011958" cp="1"/>
          <dp ct="2608012000"/>
        </s>
      </timetable>
    XML
  end

  def stub_get(body)
    allow(client).to receive(:get).and_return(body)
  end

  describe "#plan" do
    before { stub_get(plan_xml) }

    it "parses times in Europe/Berlin and exposes a trip key shared across stations" do
      stop = client.plan("8001875", Time.utc(2026, 8, 1, 17, 0), line: "RB21").fetch(stop_id)

      expect(stop[:trip]).to eq("4344706044913795844-2608011938")
      expect(stop[:arrival]).to eq(Time.utc(2026, 8, 1, 17, 53)) # 19:53 CEST
      expect(stop[:departure]).to eq(Time.utc(2026, 8, 1, 17, 55))
      expect(stop[:destination]).to eq("Nürnberg Nordost")
    end

    it "drops stops of other lines when a line is given" do
      expect(client.plan("8001875", Time.utc(2026, 8, 1, 17, 0), line: "RB21").keys).to contain_exactly(stop_id)
      expect(client.plan("8001875", Time.utc(2026, 8, 1, 17, 0)).keys.size).to eq(2)
    end

    it "requests the hour slice in German local time" do
      client.plan("8001875", Time.utc(2026, 8, 1, 17, 0))
      expect(client).to have_received(:get).with("plan/8001875/260801/19")
    end
  end

  describe "#changes" do
    before { stub_get(changes_xml) }

    it "prefers the changed time over the planned one" do
      stop = client.changes("8001875").fetch(stop_id)

      expect(stop[:arrival]).to eq(Time.utc(2026, 8, 1, 17, 58))
      expect(stop[:departure]).to eq(Time.utc(2026, 8, 1, 18, 0))
    end
  end

  describe "#eva" do
    # The pattern matches on name prefix, so anything sharing the prefix comes back too
    let(:stations_xml) do
      <<~XML
        <stations>
          <station p="1" name="Neunkirchen a Sand Ort" eva="8070652" ds100="NNKO" db="true"/>
          <station p="1|2" name="Neunkirchen a Sand" eva="8004310" ds100="NNKS" db="true"/>
        </stations>
      XML
    end

    before { stub_get(stations_xml) }

    it "matches the OSM spelling of a station name against the DB one" do
      expect(client.eva("Neunkirchen (a Sand)")).to eq("8004310")
    end

    it "finds the exact match behind a longer prefix hit" do
      expect(client.eva("Neunkirchen a Sand")).to eq("8004310")
    end

    it "asks for the full name, spaces and all" do
      client.eva("Neunkirchen a Sand")
      expect(client).to have_received(:get).with("station/Neunkirchen%20a%20Sand")
    end

    it "drops the space before a bracket, which the DB spelling does not have" do
      client.eva("Lauf (rechts Pegnitz)")
      expect(client).to have_received(:get).with("station/Lauf%28rechts%20Pegnitz%29")
    end

    it "drops a best match that is another station" do
      expect(client.eva("Neunkirchen")).to be_nil
    end

    context "when DB writes the name without the space before the bracket" do
      let(:stations_xml) do
        <<~XML
          <stations>
            <station p="1|2" name="Lauf(rechts Pegnitz)" eva="8003581" ds100="NLR" db="true"/>
          </stations>
        XML
      end

      it "matches the OSM spelling anyway" do
        expect(client.eva("Lauf (rechts Pegnitz)")).to eq("8003581")
      end

      it "still refuses a station that only shares the prefix" do
        expect(client.eva("Lauf")).to be_nil
      end
    end
  end

  describe "#eva_by_ds100" do
    let(:station_xml) do
      <<~XML
        <stations>
          <station p="1|2" name="Lauf(rechts Pegnitz)" eva="8003581" ds100="NLR" db="true"/>
        </stations>
      XML
    end

    before { stub_get(station_xml) }

    it "returns the eva of the station carrying the code" do
      expect(client.eva_by_ds100("NLR")).to eq("8003581")
    end

    it "drops a hit that carries another code" do
      expect(client.eva_by_ds100("NL")).to be_nil
    end
  end

  it "refuses to build without credentials" do
    expect { described_class.new(client_id: nil, api_key: "key") }.to raise_error(described_class::Error)
  end
end
