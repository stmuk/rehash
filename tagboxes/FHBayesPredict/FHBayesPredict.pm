#!/usr/bin/perl -w
# This code is a part of Slash, and is released under the GPL.
# Copyright 1997-2009 by Open Source Technology Group. See README
# and COPYING for more information, or see http://slashcode.com/.

package Slash::Tagbox::FHBayesPredict

=head1 NAME

Slash::Tagbox::FHBayesPredict - Use Algorithm::NaiveBayes to predict spam

=head1 SYNOPSIS

	my $tagbox_tcu = getObject("Slash::Tagbox::FHBayesPredict");
	my $feederlog_ar = $tagbox_tcu->feed_newtags($users_ar);
	$tagbox_tcu->run($affected_globjid);

=cut

use strict;

use Slash;

our $VERSION = $Slash::Constants::VERSION;

use base 'Slash::Tagbox';

sub init {
	my($self) = @_;
	return 0 if ! $self->SUPER::init();

	$self->{taguid} = $constants->{fhbp_uid};
	return 0 unless $self->{taguid};

	1;
}

sub init_tagfilters {
	my($self) = @_;
	$self->{filter_firehoseonly} = 1;
}

sub get_nosy_gtids {
	# Not interested in trying to predict comment spam (yet).
	return [ map { $types->{$_} }
	         grep { $_ !~ /^\d+$/ && $_ ne 'comments' }
	         keys %$types ];
}

sub get_affected_type	{ 'globj' }
sub get_clid		{ 'vote' }

# This tagbox is only nosy for when a globj is first created.
# It doesn't care about tags.

sub feed_newtags_filter {
	my($self, $tags_ar) = @_;
	return [ ];
}

sub run_process {
	my($self, $affected_id, $tags_ar, $options) = @_;

	$self->{taguid} = $constants->{fhbp_uid};

	my $hose_reader = getObject('Slash::FireHose', { db_type => 'reader' });
	my $fh = $hose_reader->getFireHoseByGlobjid($affected_id);
	return unless $fh;

	my %attr = ( );
	map { $attr{$_} ||= 0; $attr{$_}++ } split_bayes($fh->{title});
	map { $attr{$_} ||= 0; $attr{$_}++ } split_bayes($fh->{introtext});
	map { $attr{$_} ||= 0; $attr{$_}++ } split_bayes($fh->{bodytext});

	my $nb = Algorithm::NaiveBayes->restore
	my $result = $nb->predict(attributes => \%attr);
	my $prediction = $result->{b} || -1;
	if ($prediction > 0.5) {
		my $tags = getObject('Slash::Tags');
		$tags->createTag({
			uid => $self->{taguid},
			globjid => $affected_id,
			tagnameid => $self->{nixid},
		});
	}

	tagboxLog(sprintf("%d prediction %.6f", $affected_id, $prediction));
}

1;
