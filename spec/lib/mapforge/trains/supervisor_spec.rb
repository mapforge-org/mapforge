require "rails_helper"

RSpec.describe Mapforge::Trains::Supervisor do
  subject(:supervisor) { described_class.new(redis: redis, prefix: "test") }

  let!(:map) { create(:map, type: "train") }
  let(:now) { Time.utc(2026, 8, 1, 12, 0) }
  let(:redis) { instance_double(Redis) }

  # The double blocks in #run until #stop, like the real Live, and the two queues make the runner
  # thread's progress observable, so no example has to poll or sleep to stay deterministic.
  let(:live) do
    instance_double(Mapforge::Trains::Live).tap do |double|
      allow(double).to receive(:run) { running << true; stopped.pop }
      allow(double).to receive(:stop) { stopped << true }
    end
  end

  def running = @running ||= Queue.new
  def stopped = @stopped ||= Queue.new

  before { allow(Mapforge::Trains::Live).to receive(:new).and_return(live) }
  # Release a runner thread an example left blocked in the fake #run
  after { stopped << true }

  # What PUBSUB NUMSUB answers: the channel names asked for, each followed by its subscriber count
  def watched(*public_ids)
    allow(redis).to receive(:pubsub) do |_subcommand, *channels|
      channels.flat_map { |name| [ name, public_ids.any? { |id| name == "test:map_channel_#{id}" } ? 1 : 0 ] }
    end
  end

  it "starts a route for a train map somebody is watching" do
    watched(map.public_id)

    supervisor.sync(now)
    running.pop

    expect(Mapforge::Trains::Live).to have_received(:new).with(map.private_id)
  end

  it "leaves a train map nobody is watching alone" do
    watched

    supervisor.sync(now)

    expect(Mapforge::Trains::Live).not_to have_received(:new)
  end

  it "ignores a watched map that is not a train map" do
    watched(create(:map).public_id)

    supervisor.sync(now)

    expect(Mapforge::Trains::Live).not_to have_received(:new)
  end

  it "keeps a route running until the linger after the last client is over" do
    watched(map.public_id)
    supervisor.sync(now)
    running.pop
    watched

    supervisor.sync(now + 1.minute)
    expect(live).not_to have_received(:stop)

    supervisor.sync(now + 1.minute + described_class::LINGER)
    expect(live).to have_received(:stop)
  end

  it "never restarts a route for a client that comes back within the linger" do
    watched(map.public_id)
    supervisor.sync(now)
    running.pop

    watched
    supervisor.sync(now + 1.minute)
    watched(map.public_id)
    supervisor.sync(now + 2.minutes)
    supervisor.sync(now + 10.minutes)

    expect(live).not_to have_received(:stop)
    expect(Mapforge::Trains::Live).to have_received(:new).once
  end

  it "keeps syncing until it is interrupted, then stops what it started" do
    watched(map.public_id)
    # Kernel#sleep, standing in for the Ctrl-C the rake task turns into an Interrupt
    allow(supervisor).to receive(:sleep).and_raise(Interrupt) # rubocop:disable RSpec/SubjectStub

    expect { supervisor.run }.to raise_error(Interrupt)
    expect(live).to have_received(:stop)
  end

  # The dead entry stays until the map goes unwatched, so a map that cannot run is not retried
  # every poll
  it "logs a route that fails to start rather than taking the supervisor down" do
    watched(map.public_id)
    allow(Mapforge::Trains::Live).to receive(:new)
      .and_raise(Mapforge::Trains::RouteMap::Error, "No track on the map")
    allow(Rails.logger).to receive(:error)

    supervisor.sync(now)
    watched
    supervisor.sync(now + described_class::LINGER)

    expect(Rails.logger).to have_received(:error).with(/RouteMap::Error No track on the map/)
  end

  it "runs no more routes at a time than the DB API budget allows" do
    maps = [ map ] + Array.new(described_class::MAX) { create(:map, type: "train") }
    watched(*maps.map(&:public_id))

    supervisor.sync(now)
    described_class::MAX.times { running.pop }

    expect(Mapforge::Trains::Live).to have_received(:new).exactly(described_class::MAX).times
  end
end
