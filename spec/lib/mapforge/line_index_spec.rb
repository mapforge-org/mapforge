require "rails_helper"

RSpec.describe Mapforge::LineIndex do
  subject(:index) { described_class.new(coordinates) }

  # unevenly spaced: a cluster of short segments, then one long straight
  let(:coordinates) { [ [ 13.0, 52.0 ], [ 13.0001, 52.0 ], [ 13.0002, 52.0 ], [ 13.01, 52.0 ] ] }

  def meters_between(a, b)
    factory = RGeo::Geographic.spherical_factory
    factory.point(*a).distance(factory.point(*b))
  end

  it "moves the same distance for every equal step, regardless of vertex spacing" do
    step = index.length / 20
    positions = (0..19).map { |i| index.position_at(step * i) }
    distances = positions.each_cons(2).map { |a, b| meters_between(a, b) }

    expect(distances).to all(be_within(0.01).of(step))
  end

  it "returns the line vertices at their cumulative distances" do
    expect(index.position_at(0)).to eq(coordinates.first)
    expect(meters_between(index.position_at(meters_between(*coordinates.first(2))), coordinates[1]))
      .to be_within(0.01).of(0)
  end

  it "maps a coordinate back to its cumulative distance along the line" do
    expect(index.distance_at(coordinates.first)).to eq(0)
    expect(index.distance_at(coordinates[1])).to be_within(0.01).of(meters_between(*coordinates.first(2)))
    expect(index.distance_at(coordinates.last)).to be_within(0.01).of(index.length)
  end

  it "wraps around at the end of the line" do
    expect(meters_between(index.position_at(index.length), coordinates.first)).to be_within(0.01).of(0)
    expect(index.position_at(index.length + 25)).to eq(index.position_at(25))
  end
end
